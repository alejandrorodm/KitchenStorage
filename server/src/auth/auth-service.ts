import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Db } from '../shared/db.js';
import { AppError } from '../shared/errors.js';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const KEY_LENGTH = 64;

export interface User {
  id: string;
  username: string;
}

export interface Session {
  token: string;
  expiresAt: Date;
}

/** Household accounts: everyone who joins with the invite code shares the same kitchen. */
export class AuthService {
  constructor(
    private readonly db: Db,
    private readonly inviteCode: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async register(username: string, password: string, inviteCode: string): Promise<{ user: User; session: Session }> {
    if (!safeEqual(inviteCode, this.inviteCode)) throw new AppError(403, 'invalid_invite', 'Invalid invite code');
    const exists = this.db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
    if (exists) throw new AppError(409, 'username_taken', 'Username already taken');

    const user: User = { id: randomUUID(), username };
    this.db
      .prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(user.id, user.username, await hashPassword(password), this.now().toISOString());
    return { user, session: this.createSession(user.id) };
  }

  async login(username: string, password: string): Promise<{ user: User; session: Session }> {
    const row = this.db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username) as
      | { id: string; username: string; password_hash: string }
      | undefined;
    // Verify against a dummy hash when the user is unknown so timing does not reveal valid usernames.
    const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !valid) throw new AppError(401, 'invalid_credentials', 'Invalid username or password');
    return { user: { id: row.id, username: row.username }, session: this.createSession(row.id) };
  }

  userForToken(token: string | undefined): User | undefined {
    if (!token) return undefined;
    const row = this.db
      .prepare(
        `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(hashToken(token), this.now().toISOString()) as User | undefined;
    return row ? { id: row.id, username: row.username } : undefined;
  }

  logout(token: string | undefined): void {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
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
    if (entry.count > this.max) throw new AppError(429, 'too_many_attempts', 'Too many attempts, try again later');
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

function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}
