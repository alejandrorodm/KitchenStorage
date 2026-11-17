import { transaction, type Db } from '../../shared/db.js';
import type { FoodItemRepository } from '../application/inventory-service.js';
import { normalizeName, toView, type FoodItem, type FoodItemView, type Location, type Unit } from '../domain/stock.js';

interface Row {
  id: string;
  name: string;
  location: Location;
  quantity: number;
  unit: Unit;
  low_threshold: number;
  created_at: string;
  updated_at: string;
  planned?: number;
}

const SELECT_WITH_PLANNED = `
  SELECT f.*, COALESCE((
    SELECT SUM(a.quantity) FROM meal_allocations a
    JOIN meals m ON m.id = a.meal_id
    WHERE a.food_item_id = f.id AND m.consumed = 0
  ), 0) AS planned
  FROM food_items f`;

export class SqliteFoodItemRepository implements FoodItemRepository {
  constructor(private readonly db: Db) {}

  list(): FoodItemView[] {
    const rows = this.db.prepare(`${SELECT_WITH_PLANNED} ORDER BY f.name COLLATE NOCASE`).all() as unknown as Row[];
    return rows.map(toViewRow);
  }

  get(id: string): FoodItemView | undefined {
    const row = this.db.prepare(`${SELECT_WITH_PLANNED} WHERE f.id = ?`).get(id) as Row | undefined;
    return row && toViewRow(row);
  }

  findSame(nameKey: string, location: Location, unit: Unit): FoodItem | undefined {
    const row = this.db
      .prepare('SELECT * FROM food_items WHERE name_key = ? AND location = ? AND unit = ? ORDER BY created_at LIMIT 1')
      .get(nameKey, location, unit) as Row | undefined;
    return row && toEntity(row);
  }

  insert(item: FoodItem): void {
    this.db
      .prepare(
        `INSERT INTO food_items (id, name, name_key, location, quantity, unit, low_threshold, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(item.id, item.name, normalizeName(item.name), item.location, item.quantity, item.unit, item.lowThreshold, item.createdAt, item.updatedAt);
  }

  update(item: FoodItem): void {
    this.db
      .prepare(
        `UPDATE food_items SET name = ?, name_key = ?, location = ?, quantity = ?, unit = ?, low_threshold = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(item.name, normalizeName(item.name), item.location, item.quantity, item.unit, item.lowThreshold, item.updatedAt, item.id);
  }

  delete(id: string): boolean {
    return Number(this.db.prepare('DELETE FROM food_items WHERE id = ?').run(id).changes) > 0;
  }

  runAtomically<T>(work: () => T): T {
    return transaction(this.db, work);
  }
}

function toEntity(row: Row): FoodItem {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    quantity: row.quantity,
    unit: row.unit,
    lowThreshold: row.low_threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toViewRow(row: Row): FoodItemView {
  return toView(toEntity(row), row.planned ?? 0);
}
