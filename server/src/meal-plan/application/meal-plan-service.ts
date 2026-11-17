import { randomUUID } from 'node:crypto';
import { conflict, notFound, AppError } from '../../shared/errors.js';
import { roundQuantity, type Unit } from '../../inventory/domain/stock.js';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export interface Allocation {
  id: string;
  foodItemId: string;
  foodName: string;
  unit: Unit;
  quantity: number;
  consumedQuantity: number;
}

export interface Meal {
  id: string;
  date: string;
  mealType: MealType;
  title: string;
  consumed: boolean;
  allocations: Allocation[];
}

export interface MealInput {
  title: string;
  allocations: { foodItemId: string; quantity: number }[];
}

export interface MealPlanRepository {
  listBetween(from: string, to: string): Meal[];
  get(id: string): Meal | undefined;
  findSlot(date: string, mealType: MealType): Meal | undefined;
  missingFoodItems(ids: string[]): string[];
  upsert(meal: Omit<Meal, 'allocations'>, allocations: { id: string; foodItemId: string; quantity: number }[]): void;
  /** Moves each allocation's consumed amount out of (or back into) stock. */
  applyConsumption(mealId: string, consume: boolean): void;
  delete(id: string): boolean;
  runAtomically<T>(work: () => T): T;
}

export class MealPlanService {
  constructor(
    private readonly meals: MealPlanRepository,
    private readonly afterChange: () => void,
  ) {}

  week(from: string, to: string): Meal[] {
    if (from > to) throw new AppError(400, 'validation_error', 'La fecha de inicio no puede ser posterior a la de fin');
    return this.meals.listBetween(from, to);
  }

  /** Creates or replaces the plan for one day and meal type. */
  save(date: string, mealType: MealType, input: MealInput): Meal {
    const merged = mergeAllocations(input.allocations);
    const missing = this.meals.missingFoodItems(merged.map((a) => a.foodItemId));
    if (missing.length) throw notFound(`No se encontraron estos alimentos: ${missing.join(', ')}`);

    const existing = this.meals.findSlot(date, mealType);
    if (existing?.consumed) throw conflict('Ya está marcada como consumida; deshazlo antes de editarla');

    const id = existing?.id ?? randomUUID();
    this.meals.runAtomically(() =>
      this.meals.upsert(
        { id, date, mealType, title: input.title.trim(), consumed: false },
        merged.map((a) => ({ id: randomUUID(), ...a })),
      ),
    );
    this.afterChange();
    return this.mustGet(id);
  }

  /** Marks a meal as eaten: its allocated food leaves the stock. */
  consume(id: string): Meal {
    return this.toggle(id, true);
  }

  /** Reverts {@link consume}: the exact amounts taken are returned to stock. */
  unconsume(id: string): Meal {
    return this.toggle(id, false);
  }

  delete(id: string): void {
    if (!this.meals.delete(id)) throw notFound('No se encontró esa entrada del menú');
    this.afterChange();
  }

  private toggle(id: string, consume: boolean): Meal {
    const meal = this.mustGet(id);
    if (meal.consumed === consume) return meal;
    this.meals.runAtomically(() => this.meals.applyConsumption(id, consume));
    this.afterChange();
    return this.mustGet(id);
  }

  private mustGet(id: string): Meal {
    const meal = this.meals.get(id);
    if (!meal) throw notFound('No se encontró esa entrada del menú');
    return meal;
  }
}

/** The same food listed twice in one meal is stored as a single allocation. */
function mergeAllocations(allocations: MealInput['allocations']) {
  const totals = new Map<string, number>();
  for (const { foodItemId, quantity } of allocations) {
    totals.set(foodItemId, roundQuantity((totals.get(foodItemId) ?? 0) + quantity));
  }
  return [...totals].map(([foodItemId, quantity]) => ({ foodItemId, quantity }));
}
