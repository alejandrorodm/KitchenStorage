import type { Location, MealType, StockStatus, Unit } from '../api/types';

// All user-facing wording for domain values lives here so the UI can be translated in one place.

export const LOCATION_LABEL: Record<Location, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
};

export const LOCATION_ICON: Record<Location, string> = {
  fridge: '🧊',
  freezer: '❄️',
  pantry: '🥫',
};

export const UNIT_LABEL: Record<Unit, string> = {
  unit: 'pcs',
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
};

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export const STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'In stock',
  low: 'Running low',
  out: 'Out of stock',
};

export function formatQuantity(quantity: number, unit: Unit | null): string {
  const value = Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit ? `${value} ${UNIT_LABEL[unit]}` : value;
}
