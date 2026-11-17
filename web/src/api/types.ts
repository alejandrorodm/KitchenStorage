// Mirrors the server's JSON contract (server/src/**/application).

export type Location = 'fridge' | 'freezer' | 'pantry';
export type Unit = 'unit' | 'g' | 'kg' | 'ml' | 'l';
export type StockStatus = 'ok' | 'low' | 'out';
export type MealType = 'breakfast' | 'lunch' | 'dinner';

export const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry'];
export const UNITS: Unit[] = ['unit', 'g', 'kg', 'ml', 'l'];
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

export interface User {
  id: string;
  username: string;
}

export interface FoodItem {
  id: string;
  name: string;
  location: Location;
  quantity: number;
  unit: Unit;
  lowThreshold: number;
  planned: number;
  available: number;
  status: StockStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FoodItemInput {
  name: string;
  location: Location;
  quantity: number;
  unit: Unit;
  lowThreshold?: number;
}

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

export interface ShoppingEntry {
  id: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  foodItemId: string | null;
  source: 'auto' | 'manual';
  checked: boolean;
  createdAt: string;
  status: StockStatus | null;
}

export interface ReceiptLine {
  name: string;
  quantity: number;
  unit: Unit;
  location: Location;
}
