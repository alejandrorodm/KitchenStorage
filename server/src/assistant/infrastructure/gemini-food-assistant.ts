import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { geminiRetryPlan, withAiRetry, type GeminiOptions, type RetryPlan } from '../../shared/gemini-retry.js';
import type { DishSuggestion, FoodAssistant, Recipe, StockLine } from '../application/assistant-service.js';

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
          recipeId: { type: 'string' },
        },
        required: ['title', 'description', 'minutes', 'uses', 'missing', 'steps', 'recipeId'],
      },
    },
  },
  required: ['dishes'],
};

const INGREDIENTS_SCHEMA = {
  type: 'object',
  properties: { ingredients: { type: 'array', items: { type: 'string' } } },
  required: ['ingredients'],
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
  recipeId: z.string().catch(''),
});

export class GeminiFoodAssistant implements FoodAssistant {
  private readonly client: GoogleGenAI;
  private readonly retry: RetryPlan;

  constructor(apiKey: string, model: string, options: GeminiOptions = {}) {
    // Structured JSON output (responseJsonSchema) is only served by v1beta; the SDK defaults to v1.
    this.client = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    this.retry = { ...geminiRetryPlan(model, options.fallbackModel), sleep: options.sleep };
  }

  async categorize(names: string[], categories: string[]): Promise<(string | null)[]> {
    const prompt = `You sort the foods of a household kitchen (names usually in Spanish) into the household's categories.
Categories (use one of these names exactly): ${JSON.stringify(categories)}.
For every food return its index and the category that fits best. Use an empty string when none fits reasonably.
Foods: ${JSON.stringify(names.map((name, index) => ({ index, name })))}`;
    return parseCategorizeResponse(await this.generate(prompt, CATEGORIZE_SCHEMA, 0), names.length);
  }

  async ingredientNames(names: string[]): Promise<string[]> {
    const prompt = `Translate the foods of a household kitchen (names usually in Spanish) into the English ingredient names a recipe database uses, e.g. "chicken breast", "eggs", "potatoes", "rice".
Leave out basic staples (salt, oil, water, sugar, spices) and anything that is not food. Return at most 8 names, the most useful for cooking a main dish first.
Foods: ${JSON.stringify(names)}`;
    return parseIngredientsResponse(await this.generate(prompt, INGREDIENTS_SCHEMA, 0));
  }

  async suggestDishes(stock: StockLine[], wish: string, recipes: Recipe[]): Promise<DishSuggestion[]> {
    const inspiration = recipes.length
      ? `Recipes from a recipe database (in English) that use some of this food, for fresh ideas: ${JSON.stringify(recipes.map(({ id, title, ingredients, instructions }) => ({ id, title, ingredients, instructions })))}.
Adapt up to 2 of them to what the household has (translated to Spanish) and set recipeId to the recipe's id; leave recipeId empty for every other dish.`
      : 'Set recipeId to an empty string.';
    const prompt = `You suggest home-cooked dishes in Spanish for a household, based on what they have at home.
Suggest 5 varied dishes. At least 3 of them must be made with the available food below, needing at most 2 other ingredients to buy (fewer is better; none is best).
Basic staples (water, salt, oil, pepper) can be assumed. For each dish:
- title and a one-sentence description, in Spanish;
- minutes: total time;
- uses: the names of the available foods it uses, written exactly as listed;
- missing: other ingredients that would have to be bought (empty when none);
- steps: 3 to 8 short steps in Spanish.
${inspiration}
${wish ? `The household asked for: ${JSON.stringify(wish)}.` : ''}
Available food: ${JSON.stringify(stock)}`;
    return parseDishesResponse(await this.generate(prompt, DISHES_SCHEMA, 0.7), recipes);
  }

  private async generate(prompt: string, schema: object, temperature: number): Promise<string | undefined> {
    const response = await withAiRetry(this.retry, (model) =>
      this.client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature },
      }),
    );
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

/** Validates the suggested dishes; malformed ones are dropped rather than trusted. Links only point to recipes that were sent. */
export function parseDishesResponse(text: string | undefined, recipes: Recipe[] = []): DishSuggestion[] {
  const urls = new Map(recipes.map((recipe) => [recipe.id, recipe.url]));
  return arrayField(text, 'dishes').flatMap((dish) => {
    const parsed = dishShape.safeParse(dish);
    if (!parsed.success) return [];
    const { recipeId, ...rest } = parsed.data;
    return [{ ...rest, sourceUrl: urls.get(recipeId) ?? null }];
  });
}

/** Distinct, non-empty ingredient names. */
export function parseIngredientsResponse(text: string | undefined): string[] {
  const names = arrayField(text, 'ingredients').flatMap((name) => (typeof name === 'string' && name.trim() ? [name.trim().slice(0, 60)] : []));
  return [...new Set(names)];
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
