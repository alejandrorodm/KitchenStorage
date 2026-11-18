import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { geminiRetryPlan, withAiRetry, type GeminiOptions, type RetryPlan } from '../../shared/gemini-retry.js';
import { LOCATIONS, UNITS } from '../../inventory/domain/stock.js';
import type { ParsedReceiptLine, ReceiptParser } from '../application/receipt-service.js';

const PROMPT = `You read photos of supermarket receipts (usually Spanish) for a household kitchen inventory.
Return only food and drink products; ignore totals, taxes, discounts, bags, cleaning or hygiene products.
For each product:
- name: a short, readable Spanish product name without brand codes or abbreviations (e.g. "LECHE SEMI HCD 6X1L" -> "Leche semidesnatada").
- quantity and unit: the amount bought. Use "kg" or "g" for weighed products, "l" or "ml" when the volume is clear (multiply packs, e.g. 6x1L -> 6 l), otherwise "unit" with the number of units.
- location: where it is normally stored at home: "fridge", "freezer" or "pantry".
- category: the household category that fits best, written exactly as one of the categories listed below, or an empty string when none fits.
If the image is not a receipt, return an empty list.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string', enum: [...UNITS] },
          location: { type: 'string', enum: [...LOCATIONS] },
          category: { type: 'string' },
        },
        required: ['name', 'quantity', 'unit', 'location', 'category'],
      },
    },
  },
  required: ['items'],
};

const responseShape = z.object({
  items: z.array(
    z.object({
      name: z.string().trim().min(1).max(120),
      quantity: z.number().finite().positive(),
      unit: z.enum(UNITS).catch('unit'),
      location: z.enum(LOCATIONS).catch('pantry'),
      category: z.string().trim().max(60).nullish().catch(null).transform((c) => c || null),
    }),
  ),
});

export class GeminiReceiptParser implements ReceiptParser {
  private readonly client: GoogleGenAI;
  private readonly retry: RetryPlan;

  constructor(apiKey: string, model: string, options: GeminiOptions = {}) {
    // Structured JSON output (responseJsonSchema) is only served by v1beta; the SDK defaults to v1.
    this.client = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    this.retry = { ...geminiRetryPlan(model, options.fallbackModel), sleep: options.sleep };
  }

  async parse(image: Buffer, mimeType: string, categories: string[]): Promise<ParsedReceiptLine[]> {
    const response = await withAiRetry(this.retry, (model) =>
      this.client.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType, data: image.toString('base64') } }, { text: `${PROMPT}\nCategories: ${JSON.stringify(categories)}` }],
          },
        ],
        config: { responseMimeType: 'application/json', responseJsonSchema: RESPONSE_SCHEMA, temperature: 0 },
      }),
    );
    return parseGeminiResponse(response.text);
  }
}

/** Validates the model output; malformed lines are dropped rather than trusted. */
export function parseGeminiResponse(text: string | undefined): ParsedReceiptLine[] {
  const json: unknown = JSON.parse(text ?? '{"items":[]}');
  const items = Array.isArray((json as { items?: unknown })?.items) ? (json as { items: unknown[] }).items : [];
  return items.flatMap((item) => {
    const line = responseShape.shape.items.element.safeParse(item);
    return line.success ? [line.data] : [];
  });
}
