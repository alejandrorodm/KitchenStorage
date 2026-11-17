import { transaction, type Db } from '../../shared/db.js';
import { stockStatus, type Unit } from '../../inventory/domain/stock.js';
import type { ShoppingEntry, ShoppingRepository } from '../application/shopping-service.js';

interface Row {
  id: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  food_item_id: string | null;
  source: 'auto' | 'manual';
  checked: number;
  created_at: string;
  available: number | null;
  low_threshold: number | null;
}

const SELECT = `
  SELECT s.id, COALESCE(f.name, s.name) AS name, s.quantity, COALESCE(f.unit, s.unit) AS unit,
         s.food_item_id, s.source, s.checked, s.created_at, f.low_threshold,
         f.quantity - COALESCE((
           SELECT SUM(a.quantity) FROM meal_allocations a JOIN meals m ON m.id = a.meal_id
           WHERE a.food_item_id = f.id AND m.consumed = 0), 0) AS available
  FROM shopping_items s LEFT JOIN food_items f ON f.id = s.food_item_id`;

export class SqliteShoppingRepository implements ShoppingRepository {
  constructor(private readonly db: Db) {}

  list(): ShoppingEntry[] {
    const rows = this.db.prepare(`${SELECT} ORDER BY s.checked, s.created_at`).all() as unknown as Row[];
    return rows.map(toEntry);
  }

  get(id: string): ShoppingEntry | undefined {
    const row = this.db.prepare(`${SELECT} WHERE s.id = ?`).get(id) as Row | undefined;
    return row && toEntry(row);
  }

  insert(entry: Omit<ShoppingEntry, 'status'>): void {
    this.db
      .prepare(
        `INSERT INTO shopping_items (id, name, quantity, unit, food_item_id, source, checked, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(entry.id, entry.name, entry.quantity, entry.unit, entry.foodItemId, entry.source, entry.checked ? 1 : 0, entry.createdAt);
  }

  setChecked(id: string, checked: boolean): boolean {
    return Number(this.db.prepare('UPDATE shopping_items SET checked = ? WHERE id = ?').run(checked ? 1 : 0, id).changes) > 0;
  }

  delete(id: string): boolean {
    return Number(this.db.prepare('DELETE FROM shopping_items WHERE id = ?').run(id).changes) > 0;
  }

  deleteChecked(): number {
    return Number(this.db.prepare('DELETE FROM shopping_items WHERE checked = 1').run().changes);
  }

  autoEntryFoodIds(): Set<string> {
    const rows = this.db
      .prepare("SELECT food_item_id FROM shopping_items WHERE source = 'auto' AND food_item_id IS NOT NULL")
      .all() as { food_item_id: string }[];
    return new Set(rows.map((r) => r.food_item_id));
  }

  deleteUncheckedAuto(foodItemIds: string[]): number {
    let removed = Number(
      this.db.prepare("DELETE FROM shopping_items WHERE source = 'auto' AND checked = 0 AND food_item_id IS NULL").run().changes,
    );
    const remove = this.db.prepare("DELETE FROM shopping_items WHERE source = 'auto' AND checked = 0 AND food_item_id = ?");
    for (const id of foodItemIds) removed += Number(remove.run(id).changes);
    return removed;
  }

  runAtomically<T>(work: () => T): T {
    return transaction(this.db, work);
  }
}

function toEntry(row: Row): ShoppingEntry {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    foodItemId: row.food_item_id,
    source: row.source,
    checked: row.checked === 1,
    createdAt: row.created_at,
    status: row.available === null || row.low_threshold === null ? null : stockStatus(row.available, row.low_threshold),
  };
}
