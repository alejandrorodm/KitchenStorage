import type { Db } from '../../shared/db.js';
import type { PushSubscriptionRepository, PushTarget } from '../application/push-notifier.js';

/** Each user keeps at most this many devices; subscribing another drops the oldest. */
export const MAX_DEVICES_PER_USER = 10;

export class SqlitePushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** A device belongs to whoever subscribed it last (e.g. after signing in as someone else). */
  save(target: PushTarget, userId: string, householdId: string): void {
    this.db
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, user_id, household_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, household_id = excluded.household_id,
           p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at`,
      )
      .run(target.endpoint, userId, householdId, target.p256dh, target.auth, this.now().toISOString());
    this.db
      .prepare(
        `DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint NOT IN (
           SELECT endpoint FROM push_subscriptions WHERE user_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT ?2)`,
      )
      .run(userId, MAX_DEVICES_PER_USER);
  }

  delete(endpoint: string, userId: string): void {
    this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, userId);
  }

  forget(endpoint: string): void {
    this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }

  forHousehold(householdId: string): PushTarget[] {
    return this.db
      .prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE household_id = ? ORDER BY created_at, rowid')
      .all(householdId) as unknown as PushTarget[];
  }
}
