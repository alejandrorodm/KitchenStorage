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
         s.food_item_id, s.source, s.checked, s.created_at,
         CASE WHEN f.id IS NULL THEN NULL ELSE COALESCE(f.low_threshold, h.low_threshold, 0) END AS low_threshold,
         f.quantity - COALESCE((
           SELECT SUM(a.quantity) FROM meal_allocations a JOIN meals m ON m.id = a.meal_id
           WHERE a.food_item_id = f.id AND m.consumed = 0), 0) AS available
  FROM shopping_items s LEFT JOIN food_items f ON f.id = s.food_item_id LEFT JOIN households h ON h.id = f.household_id`;

export class SqliteShoppingRepository implements ShoppingRepository {
  constructor(
    private readonly db: Db,
    private readonly householdId: string,
  ) {}

  list(): ShoppingEntry[] {
    const rows = this.db.prepare(`${SELECT} WHERE s.household_id = ? ORDER BY s.checked, s.created_at`).all(this.householdId) as unknown as Row[];
    return rows.map(toEntry);
  }

  get(id: string): ShoppingEntry | undefined {
    const row = this.db.prepare(`${SELECT} WHERE s.id = ? AND s.household_id = ?`).get(id, this.householdId) as Row | undefined;
    return row && toEntry(row);
  }

  insert(entry: Omit<ShoppingEntry, 'status'>): void {
    this.db
      .prepare(
        `INSERT INTO shopping_items (id, household_id, name, quantity, unit, food_item_id, source, checked, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(entry.id, this.householdId, entry.name, entry.quantity, entry.unit, entry.foodItemId, entry.source, entry.checked ? 1 : 0, entry.createdAt);
  }

  setChecked(id: string, checked: boolean): boolean {
    return Number(this.db.prepare('UPDATE shopping_items SET checked = ? WHERE id = ? AND household_id = ?').run(checked ? 1 : 0, id, this.householdId).changes) > 0;
  }

  delete(id: string): boolean {
    return Number(this.db.prepare('DELETE FROM shopping_items WHERE id = ? AND household_id = ?').run(id, this.householdId).changes) > 0;
  }

  deleteChecked(): number {
    return Number(this.db.prepare('DELETE FROM shopping_items WHERE household_id = ? AND checked = 1').run(this.householdId).changes);
  }

  autoEntryFoodIds(): Set<string> {
    const rows = this.db
      .prepare("SELECT food_item_id FROM shopping_items WHERE household_id = ? AND source = 'auto' AND food_item_id IS NOT NULL")
      .all(this.householdId) as { food_item_id: string }[];
    return new Set(rows.map((r) => r.food_item_id));
  }

  deleteAutoFor(foodItemIds: string[]): number {
    let removed = Number(
      this.db.prepare("DELETE FROM shopping_items WHERE household_id = ? AND source = 'auto' AND food_item_id IS NULL").run(this.householdId).changes,
    );
    const remove = this.db.prepare("DELETE FROM shopping_items WHERE household_id = ? AND source = 'auto' AND food_item_id = ?");
    for (const id of foodItemIds) removed += Number(remove.run(this.householdId, id).changes);
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
