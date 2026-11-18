import { randomUUID } from 'node:crypto';
import type { Db } from '../../shared/db.js';
import { normalizeName } from '../../inventory/domain/stock.js';
import type { CategoryRepository } from '../application/category-service.js';
import { DEFAULT_CATEGORIES, type Category } from '../domain/category.js';

/** Gives a household the basic categories (used for new households and by the migration). */
export function insertDefaultCategories(db: Db, householdId: string, createdAt: string): void {
  const insert = db.prepare('INSERT OR IGNORE INTO categories (id, household_id, name, name_key, created_at) VALUES (?, ?, ?, ?, ?)');
  for (const name of DEFAULT_CATEGORIES) insert.run(randomUUID(), householdId, name, normalizeName(name), createdAt);
}

export class SqliteCategoryRepository implements CategoryRepository {
  constructor(
    private readonly db: Db,
    private readonly householdId: string,
  ) {}

  list(): Category[] {
    return this.db.prepare('SELECT id, name FROM categories WHERE household_id = ?').all(this.householdId) as unknown as Category[];
  }

  get(id: string): Category | undefined {
    return this.db.prepare('SELECT id, name FROM categories WHERE id = ? AND household_id = ?').get(id, this.householdId) as Category | undefined;
  }

  findByKey(nameKey: string): Category | undefined {
    return this.db.prepare('SELECT id, name FROM categories WHERE name_key = ? AND household_id = ?').get(nameKey, this.householdId) as Category | undefined;
  }

  insert(category: Category, createdAt: string): void {
    this.db
      .prepare('INSERT INTO categories (id, household_id, name, name_key, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(category.id, this.householdId, category.name, normalizeName(category.name), createdAt);
  }

  rename(id: string, name: string): void {
    this.db.prepare('UPDATE categories SET name = ?, name_key = ? WHERE id = ? AND household_id = ?').run(name, normalizeName(name), id, this.householdId);
  }

  delete(id: string): boolean {
    return Number(this.db.prepare('DELETE FROM categories WHERE id = ? AND household_id = ?').run(id, this.householdId).changes) > 0;
  }
}
