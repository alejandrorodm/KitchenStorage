import { randomUUID } from 'node:crypto';
import { conflict, notFound } from '../../shared/errors.js';
import { normalizeName } from '../../inventory/domain/stock.js';
import { sortCategories, type Category } from '../domain/category.js';

export interface CategoryRepository {
  list(): Category[];
  get(id: string): Category | undefined;
  findByKey(nameKey: string): Category | undefined;
  insert(category: Category, createdAt: string): void;
  rename(id: string, name: string): void;
  delete(id: string): boolean;
}

export class CategoryService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly afterChange: () => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(): Category[] {
    return sortCategories(this.categories.list());
  }

  exists(id: string): boolean {
    return this.categories.get(id) !== undefined;
  }

  /** Maps a category name (e.g. chosen by the AI) to its id, ignoring case and accents; unknown names give null. */
  resolver(): (name: string | null | undefined) => string | null {
    const byKey = new Map(this.categories.list().map((c) => [normalizeName(c.name), c.id]));
    return (name) => (name ? (byKey.get(normalizeName(name)) ?? null) : null);
  }

  create(name: string): Category {
    const category = { id: randomUUID(), name: name.trim() };
    this.ensureFree(category.name);
    this.categories.insert(category, this.now().toISOString());
    this.afterChange();
    return category;
  }

  rename(id: string, name: string): Category {
    if (!this.exists(id)) throw notFound('No se encontró la sección');
    const trimmed = name.trim();
    this.ensureFree(trimmed, id);
    this.categories.rename(id, trimmed);
    this.afterChange();
    return { id, name: trimmed };
  }

  /** Items in a deleted category stay, without a category. */
  delete(id: string): void {
    if (!this.categories.delete(id)) throw notFound('No se encontró la sección');
    this.afterChange();
  }

  private ensureFree(name: string, exceptId?: string): void {
    const existing = this.categories.findByKey(normalizeName(name));
    if (existing && existing.id !== exceptId) throw conflict(`Ya existe una sección llamada «${name}»`);
  }
}
