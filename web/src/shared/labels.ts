import type { Location, MealType, StockStatus, Unit } from '../api/types';

// All user-facing wording for domain values lives here so the UI can be translated in one place.

export const LOCATION_LABEL: Record<Location, string> = {
  fridge: 'Nevera',
  freezer: 'Congelador',
  pantry: 'Despensa',
};

export const LOCATION_ICON: Record<Location, string> = {
  fridge: '🧊',
  freezer: '❄️',
  pantry: '🥫',
};

export const UNIT_LABEL: Record<Unit, string> = {
  unit: 'ud.',
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
};

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
};

export const STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'Disponible',
  low: 'Se está acabando',
  out: 'Agotado',
};

export function formatQuantity(quantity: number, unit: Unit | null): string {
  const value = Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString('es-ES', { maximumFractionDigits: 3 });
  return unit ? `${value} ${UNIT_LABEL[unit]}` : value;
}
