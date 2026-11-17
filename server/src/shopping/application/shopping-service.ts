import { randomUUID } from 'node:crypto';
import { notFound } from '../../shared/errors.js';
import type { FoodItemView, StockStatus, Unit } from '../../inventory/domain/stock.js';

export interface ShoppingEntry {
  id: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  foodItemId: string | null;
  source: 'auto' | 'manual';
  checked: boolean;
  createdAt: string;
  /** Stock status of the linked food item, when there is one. */
  status: StockStatus | null;
}

export interface NewShoppingEntry {
  name: string;
  quantity?: number | null;
  unit?: Unit | null;
}

export interface ShoppingRepository {
  list(): ShoppingEntry[];
  get(id: string): ShoppingEntry | undefined;
  insert(entry: Omit<ShoppingEntry, 'status'>): void;
  setChecked(id: string, checked: boolean): boolean;
  delete(id: string): boolean;
  deleteChecked(): number;
  autoEntryFoodIds(): Set<string>;
  /** Deletes auto entries (checked or not) whose food item is gone or listed in `foodItemIds`. */
  deleteAutoFor(foodItemIds: string[]): number;
  runAtomically<T>(work: () => T): T;
}

export class ShoppingService {
  constructor(
    private readonly entries: ShoppingRepository,
    private readonly afterChange: () => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(): ShoppingEntry[] {
    return this.entries.list();
  }

  add(input: NewShoppingEntry): ShoppingEntry {
    const id = randomUUID();
    this.entries.insert({
      id,
      name: input.name.trim(),
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      foodItemId: null,
      source: 'manual',
      checked: false,
      createdAt: this.now().toISOString(),
    });
    this.afterChange();
    return this.entries.get(id)!;
  }

  setChecked(id: string, checked: boolean): ShoppingEntry {
    if (!this.entries.setChecked(id, checked)) throw notFound('No se encontró el artículo de la lista');
    this.afterChange();
    return this.entries.get(id)!;
  }

  delete(id: string): void {
    if (!this.entries.delete(id)) throw notFound('No se encontró el artículo de la lista');
    this.afterChange();
  }

  clearChecked(): number {
    const removed = this.entries.deleteChecked();
    this.afterChange();
    return removed;
  }

  /**
   * Keeps automatic entries in line with stock: every low or out item gets
   * exactly one entry, and automatic entries disappear once the item is back
   * above its threshold (or deleted), so it is listed again if it runs out
   * later. Returns whether anything changed.
   */
  syncWithStock(items: FoodItemView[]): boolean {
    return this.entries.runAtomically(() => {
      const listed = this.entries.autoEntryFoodIds();
      let changed = false;
      for (const item of items) {
        if (item.status === 'ok' || listed.has(item.id)) continue;
        this.entries.insert({
          id: randomUUID(),
          name: item.name,
          quantity: null,
          unit: item.unit,
          foodItemId: item.id,
          source: 'auto',
          checked: false,
          createdAt: this.now().toISOString(),
        });
        changed = true;
      }
      const restocked = items.filter((item) => item.status === 'ok').map((item) => item.id);
      return this.entries.deleteAutoFor(restocked) > 0 || changed;
    });
  }
}
