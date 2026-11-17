import { AppError } from '../../shared/errors.js';
import type { InventoryService, NewFoodItem, StockAddition } from '../../inventory/application/inventory-service.js';

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;

/** A product line read from a receipt, already mapped to inventory terms. */
export type ReceiptLine = Required<Pick<NewFoodItem, 'name' | 'quantity' | 'unit' | 'location'>>;

/** Port: anything that can turn a receipt photo into product lines (Gemini in production). */
export interface ReceiptParser {
  parse(image: Buffer, mimeType: string): Promise<ReceiptLine[]>;
}

export class ReceiptService {
  constructor(
    private readonly parser: ReceiptParser | null,
    private readonly inventory: InventoryService,
  ) {}

  get enabled(): boolean {
    return this.parser !== null;
  }

  /** Reads the receipt but stores nothing: the user reviews the lines first. */
  async read(image: Buffer, mimeType: string): Promise<ReceiptLine[]> {
    if (!this.parser) throw new AppError(503, 'receipts_disabled', 'Receipt reading is not configured (missing GEMINI_API_KEY)');
    if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType)) {
      throw new AppError(415, 'unsupported_image', `Unsupported image type ${mimeType}`);
    }
    try {
      return await this.parser.parse(image, mimeType);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'receipt_read_failed', 'Could not read the receipt, try again or add items manually');
    }
  }

  /** Adds the reviewed lines to stock, merging with matching items. */
  confirm(lines: ReceiptLine[]): StockAddition[] {
    return this.inventory.addStock(lines);
  }
}
