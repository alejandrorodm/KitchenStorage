import { randomUUID } from 'node:crypto';
import { AppError, notFound } from '../../shared/errors.js';
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
  /** Omitted or null: follow the household setting. */
  lowThreshold?: number | null;
  /** Omitted or null: no category. */
  categoryId?: string | null;
}

export type FoodItemChanges = Partial<NewFoodItem>;

export interface StockAddition {
  item: FoodItemView;
  merged: boolean;
}

export class InventoryService {
  constructor(
    private readonly items: FoodItemRepository,
    private readonly afterStockChange: () => void,
    /** Whether a category exists in this household. */
    private readonly categoryExists: (id: string) => boolean,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(): FoodItemView[] {
    return this.items.list();
  }

  create(input: NewFoodItem): FoodItemView {
    this.checkCategory(input.categoryId);
    const timestamp = this.now().toISOString();
    const item: FoodItem = {
      id: randomUUID(),
      name: input.name.trim(),
      location: input.location,
      quantity: roundQuantity(input.quantity),
      unit: input.unit,
      lowThreshold: input.lowThreshold ?? null,
      categoryId: input.categoryId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.items.insert(item);
    this.afterStockChange();
    return this.mustGet(item.id);
  }

  update(id: string, changes: FoodItemChanges): FoodItemView {
    this.checkCategory(changes.categoryId);
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

  /**
   * Sets the category of items that still have none (others are left alone),
   * atomically and with one notification. Returns how many were placed.
   */
  assignCategories(assignments: { id: string; categoryId: string }[]): number {
    for (const { categoryId } of assignments) this.checkCategory(categoryId);
    const placed = this.items.runAtomically(() =>
      assignments.filter(({ id, categoryId }) => {
        const current = this.items.get(id);
        if (!current || current.categoryId) return false;
        this.items.update({ ...stripView(current), categoryId, updatedAt: this.now().toISOString() });
        return true;
      }).length,
    );
    if (placed) this.afterStockChange();
    return placed;
  }

  /** Re-evaluates alerts after the household threshold changed. */
  alertSettingsChanged(): void {
    this.afterStockChange();
  }

  delete(id: string): void {
    if (!this.items.delete(id)) throw notFound('No se encontró el alimento');
    this.afterStockChange();
  }

  /**
   * Adds purchased stock: merges into the item with the same name, location
   * and unit when it exists, otherwise creates a new item. All lines are
   * applied atomically and listeners are notified once. A merged item keeps
   * its category, or takes the line's when it had none.
   */
  addStock(lines: NewFoodItem[]): StockAddition[] {
    for (const line of lines) this.checkCategory(line.categoryId);
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
            lowThreshold: line.lowThreshold ?? null,
            categoryId: line.categoryId ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          this.items.insert(item);
          return { id: item.id, merged: false };
        }
        this.items.update({
          ...existing,
          quantity: roundQuantity(existing.quantity + line.quantity),
          categoryId: existing.categoryId ?? line.categoryId ?? null,
          updatedAt: this.now().toISOString(),
        });
        return { id: existing.id, merged: true };
      }),
    );
    this.afterStockChange();
    return results.map(({ id, merged }) => ({ item: this.mustGet(id), merged }));
  }

  private checkCategory(categoryId: string | null | undefined): void {
    if (categoryId && !this.categoryExists(categoryId)) throw new AppError(400, 'unknown_category', 'Esa sección no existe');
  }

  private mustGet(id: string): FoodItemView {
    const item = this.items.get(id);
    if (!item) throw notFound('No se encontró el alimento');
    return item;
  }
}

function stripView({ planned: _p, available: _a, alertAt: _t, status: _s, ...item }: FoodItemView): FoodItem {
  return item;
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
