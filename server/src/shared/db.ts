import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

const MIGRATIONS: string[] = [
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
];

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let version = row.user_version; version < MIGRATIONS.length; version++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[version]!);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
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
