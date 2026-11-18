import { randomUUID } from 'node:crypto';
import { normalizeName } from '../../inventory/domain/stock.js';
import { conflict, notFound } from '../../shared/errors.js';
import { sortDishes, type Dish, type DishInput } from '../domain/dish.js';

export interface DishRepository {
  list(): Dish[];
  get(id: string): Dish | undefined;
  findByKey(titleKey: string): Dish | undefined;
  insert(dish: Dish): void;
  update(dish: Dish): void;
  delete(id: string): boolean;
}

const missing = () => notFound('No se encontró el plato');
const taken = (title: string) => conflict(`Ya tienes un plato llamado «${title}»`);

export class DishService {
  constructor(
    private readonly dishes: DishRepository,
    private readonly afterChange: () => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(): Dish[] {
    return sortDishes(this.dishes.list());
  }

  create(input: DishInput): Dish {
    const dish: Dish = { ...input, title: input.title.trim(), id: randomUUID(), createdAt: this.now().toISOString() };
    this.ensureFree(dish.title);
    this.guardDuplicate(dish.title, () => this.dishes.insert(dish));
    this.afterChange();
    return dish;
  }

  update(id: string, changes: Partial<DishInput>): Dish {
    const current = this.dishes.get(id);
    if (!current) throw missing();
    const dish: Dish = { ...current, ...changes, title: (changes.title ?? current.title).trim() };
    this.ensureFree(dish.title, id);
    this.guardDuplicate(dish.title, () => this.dishes.update(dish));
    this.afterChange();
    return dish;
  }

  delete(id: string): void {
    if (!this.dishes.delete(id)) throw missing();
    this.afterChange();
  }

  private ensureFree(title: string, exceptId?: string): void {
    const existing = this.dishes.findByKey(normalizeName(title));
    if (existing && existing.id !== exceptId) throw taken(title);
  }

  /** Two saves of the same title at once both pass ensureFree; the database's unique rule catches the second. */
  private guardDuplicate(title: string, write: () => void): void {
    try {
      write();
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) throw taken(title);
      throw error;
    }
  }
}
