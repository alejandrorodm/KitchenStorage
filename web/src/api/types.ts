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
  householdId: string;
  householdName: string;
  isAdmin: boolean;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  /** Items without their own value alert when what is left is at or under this (0: when it runs out). */
  lowThreshold: number;
  members: { username: string; isAdmin: boolean }[];
}

/** Single-use code from an admin; registering with it creates a new household. */
export interface Invite {
  code: string;
  createdAt: string;
  usedBy: string | null;
  usedAt: string | null;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  createdAt: string;
  members: string[];
}

/** A food category of the household, such as Proteínas or Frutas. */
export interface Category {
  id: string;
  name: string;
}

export interface FoodItem {
  id: string;
  name: string;
  location: Location;
  quantity: number;
  unit: Unit;
  /** The item's own alert threshold; null follows the household setting. */
  lowThreshold: number | null;
  categoryId: string | null;
  planned: number;
  available: number;
  /** The threshold in effect (its own or the household's). */
  alertAt: number;
  status: StockStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FoodItemInput {
  name: string;
  location: Location;
  quantity: number;
  unit: Unit;
  lowThreshold?: number | null;
  categoryId?: string | null;
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
  /** Suggested by the AI from the household categories; null when none fits. */
  categoryId: string | null;
}

/** A dish idea from the AI, built around what is in stock. */
export interface DishSuggestion {
  title: string;
  description: string;
  minutes: number;
  uses: string[];
  missing: string[];
  steps: string[];
  /** TheMealDB recipe the idea adapts, if any. */
  sourceUrl: string | null;
}

/** A dish the household keeps in My dishes. */
export interface Dish {
  id: string;
  title: string;
  description: string;
  minutes: number | null;
  ingredients: string[];
  steps: string[];
  sourceUrl: string | null;
  createdAt: string;
}

export type DishInput = Omit<Dish, 'id' | 'createdAt'>;
