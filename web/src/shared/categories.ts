import type { Category } from '../api/types';

/** Id of the group of items without a category (or whose category no longer exists). */
export const UNCATEGORIZED = '';

export interface CategoryGroup<T> {
  id: string;
  name: string;
  items: T[];
}

/**
 * One group per category, in the order given, followed by the items without
 * a known category (left out when there are none).
 */
export function groupByCategory<T extends { categoryId: string | null }>(items: T[], categories: Category[]): CategoryGroup<T>[] {
  const known = new Set(categories.map((c) => c.id));
  const groups = categories.map((c) => ({ id: c.id, name: c.name, items: items.filter((i) => i.categoryId === c.id) }));
  const rest = items.filter((i) => !i.categoryId || !known.has(i.categoryId));
  return rest.length ? [...groups, { id: UNCATEGORIZED, name: 'Sin sección', items: rest }] : groups;
}
