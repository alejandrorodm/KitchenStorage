import { randomUUID } from 'node:crypto';
import type { Db } from '../shared/db.js';
import { AppError, conflict, notFound } from '../shared/errors.js';
import { generateInviteCode, normalizeInviteCode } from '../shared/invite-code.js';

export interface HouseholdView {
  id: string;
  name: string;
  /** Code that adds whoever registers with it to this household. */
  inviteCode: string;
  members: { username: string; isAdmin: boolean }[];
}

/** A single-use code from an admin: registering with it creates a new household. */
export interface Invite {
  code: string;
  createdAt: string;
  usedBy: string | null;
  usedAt: string | null;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  createdAt: string;
  members: string[];
}

/** What a registration code gives access to. */
export type CodeTarget = { kind: 'household'; householdId: string } | { kind: 'invite'; code: string };

export const invalidInvite = () => new AppError(403, 'invalid_invite', 'El código de invitación no es correcto');

export class HouseholdService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  view(householdId: string): HouseholdView {
    const household = this.db.prepare('SELECT id, name, invite_code FROM households WHERE id = ?').get(householdId) as
      | { id: string; name: string; invite_code: string }
      | undefined;
    if (!household) throw notFound('No se encontró tu casa');
    const members = this.db
      .prepare('SELECT username, is_admin FROM users WHERE household_id = ? ORDER BY created_at, rowid')
      .all(householdId) as { username: string; is_admin: number }[];
    return {
      id: household.id,
      name: household.name,
      inviteCode: household.invite_code,
      members: members.map((m) => ({ username: m.username, isAdmin: m.is_admin === 1 })),
    };
  }

  /** Replaces the household code; the old one stops working at once. */
  regenerateCode(householdId: string): HouseholdView {
    this.db.prepare('UPDATE households SET invite_code = ? WHERE id = ?').run(this.uniqueCode(), householdId);
    return this.view(householdId);
  }

  create(name: string): string {
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO households (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)')
      .run(id, name, this.uniqueCode(), this.now().toISOString());
    return id;
  }

  exists(householdId: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM households WHERE id = ?').get(householdId);
  }

  /** Finds what a registration code opens: a household to join, or an unused admin invite. */
  resolveCode(input: string): CodeTarget | undefined {
    const code = normalizeInviteCode(input);
    if (!code) return undefined;
    const household = this.db.prepare('SELECT id FROM households WHERE invite_code = ?').get(code) as { id: string } | undefined;
    if (household) return { kind: 'household', householdId: household.id };
    const invite = this.db.prepare('SELECT 1 FROM invites WHERE code = ? AND used_at IS NULL').get(code);
    return invite ? { kind: 'invite', code } : undefined;
  }

  /** Marks an invite as spent; fails if someone else used it first. */
  consumeInvite(code: string, userId: string): void {
    const changes = this.db
      .prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_at IS NULL')
      .run(userId, this.now().toISOString(), code).changes;
    if (Number(changes) === 0) throw invalidInvite();
  }

  createInvite(createdBy: string | null): Invite {
    const invite: Invite = { code: this.uniqueCode(), createdAt: this.now().toISOString(), usedBy: null, usedAt: null };
    this.db.prepare('INSERT INTO invites (code, created_by, created_at) VALUES (?, ?, ?)').run(invite.code, createdBy, invite.createdAt);
    return invite;
  }

  listInvites(): Invite[] {
    const rows = this.db
      .prepare(
        `SELECT i.code, i.created_at, u.username AS used_by, i.used_at
         FROM invites i LEFT JOIN users u ON u.id = i.used_by
         ORDER BY i.created_at DESC, i.rowid DESC`,
      )
      .all() as { code: string; created_at: string; used_by: string | null; used_at: string | null }[];
    return rows.map((r) => ({ code: r.code, createdAt: r.created_at, usedBy: r.used_by, usedAt: r.used_at }));
  }

  /** Deletes an invite nobody has used yet. */
  revokeInvite(input: string): void {
    const code = normalizeInviteCode(input);
    const row = this.db.prepare('SELECT used_at FROM invites WHERE code = ?').get(code) as { used_at: string | null } | undefined;
    if (!row) throw notFound('No existe ese código');
    if (row.used_at) throw conflict('Ese código ya se ha usado y no se puede revocar');
    this.db.prepare('DELETE FROM invites WHERE code = ?').run(code);
  }

  listHouseholds(): HouseholdSummary[] {
    const households = this.db.prepare('SELECT id, name, created_at FROM households ORDER BY created_at, rowid').all() as {
      id: string;
      name: string;
      created_at: string;
    }[];
    const members = this.db.prepare('SELECT household_id, username FROM users ORDER BY created_at, rowid').all() as {
      household_id: string;
      username: string;
    }[];
    return households.map((h) => ({
      id: h.id,
      name: h.name,
      createdAt: h.created_at,
      members: members.filter((m) => m.household_id === h.id).map((m) => m.username),
    }));
  }

  /** Household and invite codes share one namespace, so a code never means two things. */
  private uniqueCode(): string {
    const taken = this.db.prepare(
      'SELECT 1 FROM households WHERE invite_code = ?1 UNION ALL SELECT 1 FROM invites WHERE code = ?1',
    );
    for (;;) {
      const code = generateInviteCode();
      if (!taken.get(code)) return code;
    }
  }
}
