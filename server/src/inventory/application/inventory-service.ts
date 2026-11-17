import { randomUUID } from 'node:crypto';
import { notFound } from '../../shared/errors.js';
import {
  normalizeName,
  roundQuantity,
  type FoodItem,
  type FoodItemView,
  type Location,
  type Unit,
} from '../domain/stock.js';

export interface FoodItemRepository {
  list(): FoodItemView[];
  get(id: string): FoodItemView | undefined;
  findSame(nameKey: string, location: Location, unit: Unit): FoodItem | undefined;
  insert(item: FoodItem): void;
  update(item: FoodItem): void;
  delete(id: string): boolean;
  runAtomically<T>(work: () => T): T;
}

export interface NewFoodItem {
  name: string;
  location: Location;
  quantity: number;
  unit: Unit;
  lowThreshold?: number;
}

export type FoodItemChanges = Partial<NewFoodItem>;

export interface StockAddition {
  item: FoodItemView;
  merged: boolean;
}

export const DEFAULT_LOW_THRESHOLD = 1;

export class InventoryService {
  constructor(
    private readonly items: FoodItemRepository,
    private readonly afterStockChange: () => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(): FoodItemView[] {
    return this.items.list();
  }

  create(input: NewFoodItem): FoodItemView {
    const timestamp = this.now().toISOString();
    const item: FoodItem = {
      id: randomUUID(),
      name: input.name.trim(),
      location: input.location,
      quantity: roundQuantity(input.quantity),
      unit: input.unit,
      lowThreshold: input.lowThreshold ?? DEFAULT_LOW_THRESHOLD,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.items.insert(item);
    this.afterStockChange();
    return this.mustGet(item.id);
  }

  update(id: string, changes: FoodItemChanges): FoodItemView {
    const current = this.mustGet(id);
    const next: FoodItem = {
      ...stripView(current),
      ...definedOnly(changes),
      updatedAt: this.now().toISOString(),
    };
    next.name = next.name.trim();
    next.quantity = roundQuantity(next.quantity);
    this.items.update(next);
    this.afterStockChange();
    return this.mustGet(id);
  }

  /** Adds (or removes, with a negative delta) stock; never goes below zero. */
  adjust(id: string, delta: number): FoodItemView {
    const current = this.mustGet(id);
    return this.update(id, { quantity: Math.max(0, roundQuantity(current.quantity + delta)) });
  }

  delete(id: string): void {
    if (!this.items.delete(id)) throw notFound('No se encontró el alimento');
    this.afterStockChange();
  }

  /**
   * Adds purchased stock: merges into the item with the same name, location
   * and unit when it exists, otherwise creates a new item. All lines are
   * applied atomically and listeners are notified once.
   */
  addStock(lines: NewFoodItem[]): StockAddition[] {
    const results = this.items.runAtomically(() =>
      lines.map((line) => {
        const existing = this.items.findSame(normalizeName(line.name), line.location, line.unit);
        if (!existing) {
          const timestamp = this.now().toISOString();
          const item: FoodItem = {
            id: randomUUID(),
            name: line.name.trim(),
            location: line.location,
            quantity: roundQuantity(line.quantity),
            unit: line.unit,
            lowThreshold: line.lowThreshold ?? DEFAULT_LOW_THRESHOLD,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          this.items.insert(item);
          return { id: item.id, merged: false };
        }
        this.items.update({
          ...existing,
          quantity: roundQuantity(existing.quantity + line.quantity),
          updatedAt: this.now().toISOString(),
        });
        return { id: existing.id, merged: true };
      }),
    );
    this.afterStockChange();
    return results.map(({ id, merged }) => ({ item: this.mustGet(id), merged }));
  }

  private mustGet(id: string): FoodItemView {
    const item = this.items.get(id);
    if (!item) throw notFound('No se encontró el alimento');
    return item;
  }
}

function stripView({ planned: _p, available: _a, status: _s, ...item }: FoodItemView): FoodItem {
  return item;
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
