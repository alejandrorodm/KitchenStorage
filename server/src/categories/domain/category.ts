export interface Category {
  id: string;
  name: string;
}

/** What every household starts with; members can rename, delete or add more. */
export const DEFAULT_CATEGORIES = [
  'Proteínas',
  'Verduras',
  'Frutas',
  'Lácteos',
  'Cereales y pasta',
  'Legumbres',
  'Bebidas',
  'Salsas y condimentos',
  'Dulces y snacks',
] as const;

/** Categories are shown in Spanish alphabetical order. */
export function sortCategories<T extends Category>(categories: T[]): T[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}
