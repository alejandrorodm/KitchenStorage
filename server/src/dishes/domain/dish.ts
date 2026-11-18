/** A dish the household keeps: written by hand or saved from an AI idea. */
export interface Dish {
  id: string;
  title: string;
  description: string;
  /** Total time, when known. */
  minutes: number | null;
  ingredients: string[];
  steps: string[];
  /** Recipe it comes from (e.g. TheMealDB), when there is one. */
  sourceUrl: string | null;
  createdAt: string;
}

export type DishInput = Omit<Dish, 'id' | 'createdAt'>;

export function sortDishes(dishes: Dish[]): Dish[] {
  return [...dishes].sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
}
