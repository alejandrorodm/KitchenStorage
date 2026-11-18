import { AppError } from '../../shared/errors.js';
import type { InventoryService, NewFoodItem, StockAddition } from '../../inventory/application/inventory-service.js';
import type { CategoryService } from '../../categories/application/category-service.js';

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;

/** A product line read from a receipt, already mapped to inventory terms. */
export type ReceiptLine = Required<Pick<NewFoodItem, 'name' | 'quantity' | 'unit' | 'location'>> & { categoryId?: string | null };

/** A line as the reader returns it: the category is one of the names it was given, if any. */
export type ParsedReceiptLine = Required<Pick<NewFoodItem, 'name' | 'quantity' | 'unit' | 'location'>> & { category?: string | null };

/** Port: anything that can turn a receipt photo into product lines (Gemini in production). */
export interface ReceiptParser {
  /** `categories` are the household's category names to choose from. */
  parse(image: Buffer, mimeType: string, categories: string[]): Promise<ParsedReceiptLine[]>;
}

export class ReceiptService {
  constructor(
    private readonly parser: ReceiptParser | null,
    private readonly inventory: InventoryService,
    private readonly categories: CategoryService,
  ) {}

  get enabled(): boolean {
    return this.parser !== null;
  }

  /** Reads the receipt but stores nothing: the user reviews the lines (and their categories) first. */
  async read(image: Buffer, mimeType: string): Promise<(ReceiptLine & { categoryId: string | null })[]> {
    if (!this.parser) throw new AppError(503, 'receipts_disabled', 'La lectura de tickets no está configurada en el servidor (falta GEMINI_API_KEY)');
    if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType)) {
      throw new AppError(415, 'unsupported_image', `Formato de imagen no admitido: ${mimeType}`);
    }
    let parsed: ParsedReceiptLine[];
    try {
      parsed = await this.parser.parse(image, mimeType, this.categories.list().map((c) => c.name));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'receipt_read_failed', 'No se pudo leer el ticket. Inténtalo de nuevo o añade los productos a mano', {
        cause: error,
      });
    }
    const resolve = this.categories.resolver();
    return parsed.map(({ category, ...line }) => ({ ...line, categoryId: resolve(category) }));
  }

  /** Adds the reviewed lines to stock, merging with matching items. */
  confirm(lines: ReceiptLine[]): StockAddition[] {
    return this.inventory.addStock(lines);
  }
}
