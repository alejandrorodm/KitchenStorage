import { normalizeName } from '../../inventory/domain/stock.js';
import type { Db } from '../../shared/db.js';
import type { DishRepository } from '../application/dish-service.js';
import type { Dish } from '../domain/dish.js';

interface DishRow {
  id: string;
  title: string;
  description: string;
  minutes: number | null;
  ingredients: string;
  steps: string;
  source_url: string | null;
  created_at: string;
}

const COLUMNS = 'id, title, description, minutes, ingredients, steps, source_url, created_at';

const toDish = (row: DishRow): Dish => ({
  id: row.id,
  title: row.title,
  description: row.description,
  minutes: row.minutes,
  ingredients: JSON.parse(row.ingredients) as string[],
  steps: JSON.parse(row.steps) as string[],
  sourceUrl: row.source_url,
  createdAt: row.created_at,
});

export class SqliteDishRepository implements DishRepository {
  constructor(
    private readonly db: Db,
    private readonly householdId: string,
  ) {}

  list(): Dish[] {
    return (this.db.prepare(`SELECT ${COLUMNS} FROM dishes WHERE household_id = ?`).all(this.householdId) as unknown as DishRow[]).map(toDish);
  }

  get(id: string): Dish | undefined {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM dishes WHERE id = ? AND household_id = ?`).get(id, this.householdId) as DishRow | undefined;
    return row && toDish(row);
  }

  findByKey(titleKey: string): Dish | undefined {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM dishes WHERE title_key = ? AND household_id = ?`).get(titleKey, this.householdId) as DishRow | undefined;
    return row && toDish(row);
  }

  insert(dish: Dish): void {
    this.db
      .prepare(
        `INSERT INTO dishes (id, household_id, title, title_key, description, minutes, ingredients, steps, source_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(dish.id, this.householdId, dish.title, normalizeName(dish.title), dish.description, dish.minutes, JSON.stringify(dish.ingredients), JSON.stringify(dish.steps), dish.sourceUrl, dish.createdAt);
  }

  update(dish: Dish): void {
    this.db
      .prepare(
        `UPDATE dishes SET title = ?, title_key = ?, description = ?, minutes = ?, ingredients = ?, steps = ?, source_url = ?
         WHERE id = ? AND household_id = ?`,
      )
      .run(dish.title, normalizeName(dish.title), dish.description, dish.minutes, JSON.stringify(dish.ingredients), JSON.stringify(dish.steps), dish.sourceUrl, dish.id, this.householdId);
  }

  delete(id: string): boolean {
    return Number(this.db.prepare('DELETE FROM dishes WHERE id = ? AND household_id = ?').run(id, this.householdId).changes) > 0;
  }
}
