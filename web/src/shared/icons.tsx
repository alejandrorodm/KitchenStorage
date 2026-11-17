import { Coffee, Moon, Package, Refrigerator, Snowflake, Soup, type LucideIcon } from 'lucide-react';
import type { Location, MealType } from '../api/types';

export const LOCATION_ICON: Record<Location, LucideIcon> = {
  fridge: Refrigerator,
  freezer: Snowflake,
  pantry: Package,
};

export const MEAL_ICON: Record<MealType, LucideIcon> = {
  breakfast: Coffee,
  lunch: Soup,
  dinner: Moon,
};
