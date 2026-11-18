import { AppError } from '../../shared/errors.js';
import type { Location, Unit } from '../../inventory/domain/stock.js';
import type { InventoryService } from '../../inventory/application/inventory-service.js';
import type { CategoryService } from '../../categories/application/category-service.js';

/** What is available to cook with, as the AI sees it. */
export interface StockLine {
  name: string;
  available: number;
  unit: Unit;
  location: Location;
}

export interface DishSuggestion {
  title: string;
  description: string;
  minutes: number;
  /** Stock items the dish uses. */
  uses: string[];
  /** Ingredients that would have to be bought. */
  missing: string[];
  steps: string[];
}

/** Port: text tasks done by an AI model (Gemini in production). */
export interface FoodAssistant {
  /** One category name (from `categories`) or null per food name, in the same order. */
  categorize(names: string[], categories: string[]): Promise<(string | null)[]>;
  suggestDishes(stock: StockLine[], wish: string): Promise<DishSuggestion[]>;
}

export const aiDisabled = () => new AppError(503, 'ai_disabled', 'La IA no está configurada en el servidor (falta GEMINI_API_KEY)');

export class AssistantService {
  constructor(
    private readonly assistant: FoodAssistant | null,
    private readonly inventory: InventoryService,
    private readonly categories: CategoryService,
  ) {}

  get enabled(): boolean {
    return this.assistant !== null;
  }

  /** Places every item without a category into one of the household's; never touches categorized items. */
  async categorizeUncategorized(): Promise<{ categorized: number; remaining: number }> {
    const assistant = this.require();
    const pending = this.inventory.list().filter((item) => !item.categoryId);
    if (!pending.length) return { categorized: 0, remaining: 0 };
    const answers = await this.call(() => assistant.categorize(pending.map((item) => item.name), this.categories.list().map((c) => c.name)));
    const resolve = this.categories.resolver();
    const assignments = pending.flatMap((item, index) => {
      const categoryId = resolve(answers[index]);
      return categoryId ? [{ id: item.id, categoryId }] : [];
    });
    const categorized = this.inventory.assignCategories(assignments);
    return { categorized, remaining: pending.length - categorized };
  }

  async suggestDishes(wish: string): Promise<DishSuggestion[]> {
    const assistant = this.require();
    const stock = this.inventory
      .list()
      .filter((item) => item.available > 0)
      .map(({ name, available, unit, location }) => ({ name, available, unit, location }));
    if (!stock.length) throw new AppError(400, 'no_stock', 'Añade alimentos para recibir ideas de platos');
    return this.call(() => assistant.suggestDishes(stock, wish.trim()));
  }

  private require(): FoodAssistant {
    if (!this.assistant) throw aiDisabled();
    return this.assistant;
  }

  private async call<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'ai_failed', 'La IA no ha respondido. Inténtalo de nuevo en un momento', { cause: error });
    }
  }
}
