import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { generateInviteCode } from './invite-code.js';

export type Db = DatabaseSync;

/** Household that receives the data created before households existed; the first admin joins it. */
export const LEGACY_HOUSEHOLD_ID = 'legacy';

type Migration = string | ((db: Db) => void);

export const MIGRATIONS: Migration[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE food_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    location TEXT NOT NULL CHECK (location IN ('fridge', 'freezer', 'pantry')),
    quantity REAL NOT NULL CHECK (quantity >= 0),
    unit TEXT NOT NULL,
    low_threshold REAL NOT NULL DEFAULT 1 CHECK (low_threshold >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX food_items_lookup ON food_items (name_key, location, unit);
  CREATE TABLE meals (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
    title TEXT NOT NULL DEFAULT '',
    consumed INTEGER NOT NULL DEFAULT 0,
    UNIQUE (date, meal_type)
  );
  CREATE TABLE meal_allocations (
    id TEXT PRIMARY KEY,
    meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    food_item_id TEXT NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    quantity REAL NOT NULL CHECK (quantity > 0),
    consumed_quantity REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE shopping_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    food_item_id TEXT REFERENCES food_items(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('auto', 'manual')),
    checked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  `,
  // v2: separate households. Existing data moves into the legacy household.
  (db) => {
    db.exec(`
      CREATE TABLE households (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        invite_code TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE invites (
        code TEXT PRIMARY KEY,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        used_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        used_at TEXT
      );
    `);
    const hasData = db
      .prepare(
        `SELECT EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM food_items)
           OR EXISTS (SELECT 1 FROM meals) OR EXISTS (SELECT 1 FROM shopping_items) AS has_data`,
      )
      .get() as { has_data: number };
    if (hasData.has_data) {
      db.prepare('INSERT INTO households (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)').run(
        LEGACY_HOUSEHOLD_ID,
        'Casa',
        generateInviteCode(),
        new Date().toISOString(),
      );
    }
    db.exec(`
      ALTER TABLE users ADD COLUMN household_id TEXT REFERENCES households(id);
      ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE food_items ADD COLUMN household_id TEXT REFERENCES households(id) ON DELETE CASCADE;
      ALTER TABLE shopping_items ADD COLUMN household_id TEXT REFERENCES households(id) ON DELETE CASCADE;
      UPDATE users SET household_id = '${LEGACY_HOUSEHOLD_ID}';
      UPDATE food_items SET household_id = '${LEGACY_HOUSEHOLD_ID}';
      UPDATE shopping_items SET household_id = '${LEGACY_HOUSEHOLD_ID}';
      DROP INDEX food_items_lookup;
      CREATE INDEX food_items_lookup ON food_items (household_id, name_key, location, unit);
      CREATE INDEX shopping_items_household ON shopping_items (household_id);
      CREATE INDEX users_household ON users (household_id);

      -- A slot is unique per household now, which needs a table rebuild.
      CREATE TABLE meals_v2 (
        id TEXT PRIMARY KEY,
        household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
        title TEXT NOT NULL DEFAULT '',
        consumed INTEGER NOT NULL DEFAULT 0,
        UNIQUE (household_id, date, meal_type)
      );
      INSERT INTO meals_v2 (id, household_id, date, meal_type, title, consumed)
        SELECT id, '${LEGACY_HOUSEHOLD_ID}', date, meal_type, title, consumed FROM meals;
      DROP TABLE meals;
      ALTER TABLE meals_v2 RENAME TO meals;
    `);
  },
  // v3: the alert threshold is a household setting (default 0: alert when it runs out).
  // An item's own threshold becomes optional (NULL follows the household), which needs a rebuild.
  `
    ALTER TABLE households ADD COLUMN low_threshold REAL NOT NULL DEFAULT 0 CHECK (low_threshold >= 0);
    CREATE TABLE food_items_v3 (
      id TEXT PRIMARY KEY,
      household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL,
      location TEXT NOT NULL CHECK (location IN ('fridge', 'freezer', 'pantry')),
      quantity REAL NOT NULL CHECK (quantity >= 0),
      unit TEXT NOT NULL,
      low_threshold REAL CHECK (low_threshold >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    -- Every existing item had the old default, so all of them now follow the household.
    INSERT INTO food_items_v3 (id, household_id, name, name_key, location, quantity, unit, low_threshold, created_at, updated_at)
      SELECT id, household_id, name, name_key, location, quantity, unit, NULL, created_at, updated_at FROM food_items;
    DROP TABLE food_items;
    ALTER TABLE food_items_v3 RENAME TO food_items;
    CREATE INDEX food_items_lookup ON food_items (household_id, name_key, location, unit);
    -- With the new threshold of 0, automatic entries for items that still have stock no longer apply.
    DELETE FROM shopping_items WHERE source = 'auto' AND food_item_id IN (
      SELECT f.id FROM food_items f
      WHERE f.quantity - COALESCE((
        SELECT SUM(a.quantity) FROM meal_allocations a JOIN meals m ON m.id = a.meal_id
        WHERE a.food_item_id = f.id AND m.consumed = 0), 0) > 0
    );
  `,
];

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

/**
 * Applies pending migrations, each in its own transaction. Foreign keys are
 * off meanwhile (the documented way to rebuild a table without cascading
 * deletes) and every migration is checked for broken references before commit.
 */
export function migrate(db: Db): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (row.user_version >= MIGRATIONS.length) return;
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    for (let version = row.user_version; version < MIGRATIONS.length; version++) {
      transaction(db, () => {
        const migration = MIGRATIONS[version]!;
        if (typeof migration === 'string') db.exec(migration);
        else migration(db);
        const broken = db.prepare('PRAGMA foreign_key_check').all();
        if (broken.length) throw new Error(`Migration ${version + 1} left broken references: ${JSON.stringify(broken)}`);
        db.exec(`PRAGMA user_version = ${version + 1}`);
      });
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

/** Runs `work` atomically; nested calls join the outer transaction. */
export function transaction<T>(db: Db, work: () => T): T {
  if (db.isTransaction) return work();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
