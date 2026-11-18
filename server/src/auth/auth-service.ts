import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { invalidInvite, type HouseholdService } from '../households/household-service.js';
import { LEGACY_HOUSEHOLD_ID, transaction, type Db } from '../shared/db.js';
import { AppError } from '../shared/errors.js';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const KEY_LENGTH = 64;

export interface User {
  id: string;
  username: string;
  householdId: string;
  householdName: string;
  isAdmin: boolean;
}

export interface Session {
  token: string;
  expiresAt: Date;
}

interface UserRow {
  id: string;
  username: string;
  household_id: string;
  household_name: string;
  is_admin: number;
}

const USER_SQL = `
  SELECT u.id, u.username, u.household_id, h.name AS household_name, u.is_admin
  FROM users u JOIN households h ON h.id = u.household_id`;

/** Accounts. Each user belongs to one household and only sees that household's kitchen. */
export class AuthService {
  constructor(
    private readonly db: Db,
    private readonly households: HouseholdService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Registration needs a code: a household's own code joins that household,
   * and a single-use admin invite creates a new household for the user.
   */
  async register(username: string, password: string, inviteCode: string): Promise<{ user: User; session: Session }> {
    const passwordHash = await hashPassword(password);
    const userId = transaction(this.db, () => {
      const target = this.households.resolveCode(inviteCode);
      if (!target) throw invalidInvite();
      if (this.findByUsername(username)) throw new AppError(409, 'username_taken', 'Ese nombre de usuario ya existe');
      const householdId = target.kind === 'household' ? target.householdId : this.households.create(`Casa de ${username}`);
      const id = this.insertUser(username, passwordHash, householdId, false);
      if (target.kind === 'invite') this.households.consumeInvite(target.code, id);
      return id;
    });
    return { user: this.mustGetUser(userId), session: this.createSession(userId) };
  }

  /**
   * Creates an admin, or promotes an existing user and resets their password.
   * A new admin joins the household that holds the data from before
   * households existed, when there is one, and otherwise gets their own.
   */
  async createAdmin(username: string, password: string): Promise<{ user: User; created: boolean }> {
    const passwordHash = await hashPassword(password);
    return transaction(this.db, () => {
      const existing = this.findByUsername(username);
      if (existing) {
        this.db.prepare('UPDATE users SET is_admin = 1, password_hash = ? WHERE id = ?').run(passwordHash, existing.id);
        this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
        return { user: this.mustGetUser(existing.id), created: false };
      }
      const householdId = this.households.exists(LEGACY_HOUSEHOLD_ID)
        ? LEGACY_HOUSEHOLD_ID
        : this.households.create(`Casa de ${username}`);
      return { user: this.mustGetUser(this.insertUser(username, passwordHash, householdId, true)), created: true };
    });
  }

  async login(username: string, password: string): Promise<{ user: User; session: Session }> {
    const row = this.db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as
      | { id: string; password_hash: string }
      | undefined;
    // Verify against a dummy hash when the user is unknown so timing does not reveal valid usernames.
    const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !valid) throw new AppError(401, 'invalid_credentials', 'Usuario o contraseña incorrectos');
    return { user: this.mustGetUser(row.id), session: this.createSession(row.id) };
  }

  userForToken(token: string | undefined): User | undefined {
    if (!token) return undefined;
    const row = this.db
      .prepare(`${USER_SQL} JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?`)
      .get(hashToken(token), this.now().toISOString()) as UserRow | undefined;
    return row && toUser(row);
  }

  logout(token: string | undefined): void {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }

  private findByUsername(username: string): { id: string } | undefined {
    return this.db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
  }

  private insertUser(username: string, passwordHash: string, householdId: string, isAdmin: boolean): string {
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO users (id, username, password_hash, created_at, household_id, is_admin) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, username, passwordHash, this.now().toISOString(), householdId, isAdmin ? 1 : 0);
    return id;
  }

  private mustGetUser(id: string): User {
    const row = this.db.prepare(`${USER_SQL} WHERE u.id = ?`).get(id) as UserRow | undefined;
    if (!row) throw new Error(`user ${id} has no household`);
    return toUser(row);
  }

  private createSession(userId: string): Session {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now().getTime() + SESSION_TTL_MS);
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(this.now().toISOString());
    this.db
      .prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(hashToken(token), userId, expiresAt.toISOString());
    return { token, expiresAt };
  }
}

/** Fixed-window limiter for login/register attempts, keyed by client address. */
export class AttemptLimiter {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max = 10,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  hit(key: string, now = Date.now()): void {
    const entry = this.attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    entry.count++;
    if (entry.count > this.max) throw new AppError(429, 'too_many_attempts', 'Demasiados intentos. Vuelve a probar en unos minutos');
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

const DUMMY_HASH = `scrypt:${Buffer.alloc(16).toString('base64')}:${Buffer.alloc(KEY_LENGTH).toString('base64')}`;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    householdId: row.household_id,
    householdName: row.household_name,
    isAdmin: row.is_admin === 1,
  };
}
