import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { DishSuggestion, FoodAssistant, StockLine } from '../application/assistant-service.js';

const CATEGORIZE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { index: { type: 'integer' }, category: { type: 'string' } },
        required: ['index', 'category'],
      },
    },
  },
  required: ['items'],
};

const DISHES_SCHEMA = {
  type: 'object',
  properties: {
    dishes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          minutes: { type: 'integer' },
          uses: { type: 'array', items: { type: 'string' } },
          missing: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'description', 'minutes', 'uses', 'missing', 'steps'],
      },
    },
  },
  required: ['dishes'],
};

const categorizedItem = z.object({ index: z.number().int().min(0), category: z.string().trim().max(60) });

const text = (max: number) => z.string().trim().min(1).max(max);
const dishShape = z.object({
  title: text(120),
  description: z.string().trim().max(400),
  minutes: z.number().int().min(1).max(600).catch(30),
  uses: z.array(text(120)).max(30),
  missing: z.array(text(120)).max(30),
  steps: z.array(text(400)).min(1).max(15),
});

export class GeminiFoodAssistant implements FoodAssistant {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    // Structured JSON output (responseJsonSchema) is only served by v1beta; the SDK defaults to v1.
    this.client = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
  }

  async categorize(names: string[], categories: string[]): Promise<(string | null)[]> {
    const prompt = `You sort the foods of a household kitchen (names usually in Spanish) into the household's categories.
Categories (use one of these names exactly): ${JSON.stringify(categories)}.
For every food return its index and the category that fits best. Use an empty string when none fits reasonably.
Foods: ${JSON.stringify(names.map((name, index) => ({ index, name })))}`;
    return parseCategorizeResponse(await this.generate(prompt, CATEGORIZE_SCHEMA, 0), names.length);
  }

  async suggestDishes(stock: StockLine[], wish: string): Promise<DishSuggestion[]> {
    const prompt = `You suggest home-cooked dishes in Spanish for a household, based on what they have at home.
Suggest 4 varied dishes that mainly use the available food below, preferring dishes that need nothing else to buy.
Basic staples (water, salt, oil, pepper) can be assumed. For each dish:
- title and a one-sentence description, in Spanish;
- minutes: total time;
- uses: the names of the available foods it uses, written exactly as listed;
- missing: other ingredients that would have to be bought (empty when none);
- steps: 3 to 8 short steps in Spanish.
${wish ? `The household asked for: ${JSON.stringify(wish)}.` : ''}
Available food: ${JSON.stringify(stock)}`;
    return parseDishesResponse(await this.generate(prompt, DISHES_SCHEMA, 0.7));
  }

  private async generate(prompt: string, schema: object, temperature: number): Promise<string | undefined> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature },
    });
    return response.text;
  }
}

/** One answer per food, in order; anything missing, empty or malformed becomes null. */
export function parseCategorizeResponse(text: string | undefined, count: number): (string | null)[] {
  const answers: (string | null)[] = Array.from({ length: count }, () => null);
  for (const item of arrayField(text, 'items')) {
    const parsed = categorizedItem.safeParse(item);
    if (parsed.success && parsed.data.index < count && parsed.data.category) answers[parsed.data.index] = parsed.data.category;
  }
  return answers;
}

/** Validates the suggested dishes; malformed ones are dropped rather than trusted. */
export function parseDishesResponse(text: string | undefined): DishSuggestion[] {
  return arrayField(text, 'dishes').flatMap((dish) => {
    const parsed = dishShape.safeParse(dish);
    return parsed.success ? [parsed.data] : [];
  });
}

function arrayField(text: string | undefined, field: string): unknown[] {
  try {
    const json = JSON.parse(text ?? '{}') as Record<string, unknown> | null;
    const value = json?.[field];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
