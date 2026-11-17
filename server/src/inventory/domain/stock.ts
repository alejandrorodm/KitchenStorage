export const LOCATIONS = ['fridge', 'freezer', 'pantry'] as const;
export type Location = (typeof LOCATIONS)[number];

export const UNITS = ['unit', 'g', 'kg', 'ml', 'l'] as const;
export type Unit = (typeof UNITS)[number];

export type StockStatus = 'ok' | 'low' | 'out';

export interface FoodItem {
  id: string;
  name: string;
  location: Location;
  quantity: number;
  unit: Unit;
  lowThreshold: number;
  createdAt: string;
  updatedAt: string;
}

/** A food item enriched with what is already promised to upcoming meals. */
export interface FoodItemView extends FoodItem {
  planned: number;
  available: number;
  status: StockStatus;
}

/**
 * "out" when nothing is left to use, "low" when what is left is at or under
 * the item's threshold, "ok" otherwise.
 */
export function stockStatus(available: number, lowThreshold: number): StockStatus {
  if (available <= 0) return 'out';
  if (available <= lowThreshold) return 'low';
  return 'ok';
}

/** Key used to recognise the same product regardless of case, accents or spacing. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Avoids floating point noise such as 0.30000000000000004 in stored quantities. */
export function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function toView(item: FoodItem, planned: number): FoodItemView {
  const available = roundQuantity(item.quantity - planned);
  return { ...item, planned: roundQuantity(planned), available, status: stockStatus(available, item.lowThreshold) };
}
