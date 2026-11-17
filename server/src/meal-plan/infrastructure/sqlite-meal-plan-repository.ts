import { transaction, type Db } from '../../shared/db.js';
import type { Unit } from '../../inventory/domain/stock.js';
import type { Allocation, Meal, MealPlanRepository, MealType } from '../application/meal-plan-service.js';

interface MealRow {
  id: string;
  date: string;
  meal_type: MealType;
  title: string;
  consumed: number;
}

interface AllocationRow {
  id: string;
  meal_id: string;
  food_item_id: string;
  name: string;
  unit: Unit;
  quantity: number;
  consumed_quantity: number;
}

const ALLOCATIONS_SQL = `
  SELECT a.id, a.meal_id, a.food_item_id, f.name, f.unit, a.quantity, a.consumed_quantity
  FROM meal_allocations a JOIN food_items f ON f.id = a.food_item_id`;

export class SqliteMealPlanRepository implements MealPlanRepository {
  constructor(private readonly db: Db) {}

  listBetween(from: string, to: string): Meal[] {
    const meals = this.db
      .prepare('SELECT * FROM meals WHERE date BETWEEN ? AND ? ORDER BY date, meal_type')
      .all(from, to) as unknown as MealRow[];
    if (!meals.length) return [];
    const allocations = this.db
      .prepare(`${ALLOCATIONS_SQL} JOIN meals m ON m.id = a.meal_id WHERE m.date BETWEEN ? AND ? ORDER BY f.name`)
      .all(from, to) as unknown as AllocationRow[];
    return meals.map((meal) => toMeal(meal, allocations.filter((a) => a.meal_id === meal.id)));
  }

  get(id: string): Meal | undefined {
    const meal = this.db.prepare('SELECT * FROM meals WHERE id = ?').get(id) as MealRow | undefined;
    return meal && this.withAllocations(meal);
  }

  findSlot(date: string, mealType: MealType): Meal | undefined {
    const meal = this.db.prepare('SELECT * FROM meals WHERE date = ? AND meal_type = ?').get(date, mealType) as MealRow | undefined;
    return meal && this.withAllocations(meal);
  }

  missingFoodItems(ids: string[]): string[] {
    const exists = this.db.prepare('SELECT 1 FROM food_items WHERE id = ?');
    return ids.filter((id) => !exists.get(id));
  }

  upsert(meal: Omit<Meal, 'allocations'>, allocations: { id: string; foodItemId: string; quantity: number }[]): void {
    this.db
      .prepare(
        `INSERT INTO meals (id, date, meal_type, title, consumed) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET title = excluded.title, consumed = excluded.consumed`,
      )
      .run(meal.id, meal.date, meal.mealType, meal.title, meal.consumed ? 1 : 0);
    this.db.prepare('DELETE FROM meal_allocations WHERE meal_id = ?').run(meal.id);
    const insert = this.db.prepare('INSERT INTO meal_allocations (id, meal_id, food_item_id, quantity) VALUES (?, ?, ?, ?)');
    for (const a of allocations) insert.run(a.id, meal.id, a.foodItemId, a.quantity);
  }

  applyConsumption(mealId: string, consume: boolean): void {
    const now = new Date().toISOString();
    if (consume) {
      // Take what was planned, but never more than what is actually in stock.
      this.db
        .prepare(
          `UPDATE meal_allocations SET consumed_quantity = MIN(quantity,
             (SELECT quantity FROM food_items WHERE id = meal_allocations.food_item_id))
           WHERE meal_id = ?`,
        )
        .run(mealId);
      this.db
        .prepare(
          `UPDATE food_items SET updated_at = ?, quantity = ROUND(quantity - (
             SELECT SUM(consumed_quantity) FROM meal_allocations WHERE meal_id = ? AND food_item_id = food_items.id), 3)
           WHERE id IN (SELECT food_item_id FROM meal_allocations WHERE meal_id = ?)`,
        )
        .run(now, mealId, mealId);
    } else {
      this.db
        .prepare(
          `UPDATE food_items SET updated_at = ?, quantity = ROUND(quantity + (
             SELECT SUM(consumed_quantity) FROM meal_allocations WHERE meal_id = ? AND food_item_id = food_items.id), 3)
           WHERE id IN (SELECT food_item_id FROM meal_allocations WHERE meal_id = ?)`,
        )
        .run(now, mealId, mealId);
      this.db.prepare('UPDATE meal_allocations SET consumed_quantity = 0 WHERE meal_id = ?').run(mealId);
    }
    this.db.prepare('UPDATE meals SET consumed = ? WHERE id = ?').run(consume ? 1 : 0, mealId);
  }

  delete(id: string): boolean {
    return Number(this.db.prepare('DELETE FROM meals WHERE id = ?').run(id).changes) > 0;
  }

  runAtomically<T>(work: () => T): T {
    return transaction(this.db, work);
  }

  private withAllocations(meal: MealRow): Meal {
    const rows = this.db.prepare(`${ALLOCATIONS_SQL} WHERE a.meal_id = ? ORDER BY f.name`).all(meal.id) as unknown as AllocationRow[];
    return toMeal(meal, rows);
  }
}

function toMeal(row: MealRow, allocations: AllocationRow[]): Meal {
  return {
    id: row.id,
    date: row.date,
    mealType: row.meal_type,
    title: row.title,
    consumed: row.consumed === 1,
    allocations: allocations.map(
      (a): Allocation => ({
        id: a.id,
        foodItemId: a.food_item_id,
        foodName: a.name,
        unit: a.unit,
        quantity: a.quantity,
        consumedQuantity: a.consumed_quantity,
      }),
    ),
  };
}
