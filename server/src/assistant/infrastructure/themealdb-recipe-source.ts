import type { Recipe, RecipeSource } from '../application/assistant-service.js';

const BASE_URL = 'https://www.themealdb.com';
/** Longest instructions passed on; enough to inspire a dish without bloating the AI prompt. */
const MAX_INSTRUCTIONS = 1200;
const MAX_INGREDIENTS = 8;

interface MealSummary {
  idMeal: string;
}

type MealDetail = { idMeal: string; strMeal: string; strInstructions: string | null } & Record<string, string | null>;

export interface TheMealDbOptions {
  /** TheMealDB key; `1` is its free key for personal and educational use. */
  apiKey?: string;
  /** How many recipes to return. */
  limit?: number;
  timeoutMs?: number;
  random?: () => number;
}

/** Recipe database at themealdb.com: searched one ingredient at a time, ranked by how many of them a meal uses. */
export class TheMealDbRecipeSource implements RecipeSource {
  private readonly apiKey: string;
  private readonly limit: number;
  private readonly timeoutMs: number;
  private readonly random: () => number;

  constructor(options: TheMealDbOptions = {}) {
    this.apiKey = options.apiKey ?? '1';
    this.limit = options.limit ?? 5;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.random = options.random ?? Math.random;
  }

  async find(ingredients: string[]): Promise<Recipe[]> {
    const queries = [...new Set(ingredients.map(toQuery).filter(Boolean))].slice(0, MAX_INGREDIENTS);
    const lists = await Promise.all(queries.map((query) => this.meals<MealSummary>('filter.php', query).catch(() => [])));

    const matches = new Map<string, number>();
    for (const meals of lists) for (const { idMeal } of meals) matches.set(idMeal, (matches.get(idMeal) ?? 0) + 1);
    // Meals sharing more ingredients first; ties in random order, so asking again brings other ideas.
    const chosen = [...matches]
      .map(([id, count]) => ({ id, count, tiebreak: this.random() }))
      .sort((a, b) => b.count - a.count || a.tiebreak - b.tiebreak)
      .slice(0, this.limit);

    const details = await Promise.all(chosen.map(({ id }) => this.meals<MealDetail>('lookup.php', id).then((meals) => meals[0]).catch(() => undefined)));
    return details.flatMap((meal) => (meal ? [toRecipe(meal)] : []));
  }

  private async meals<T>(endpoint: string, value: string): Promise<T[]> {
    const url = `${BASE_URL}/api/json/v1/${this.apiKey}/${endpoint}?i=${encodeURIComponent(value)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) throw new Error(`TheMealDB answered ${response.status}`);
    const body = (await response.json()) as { meals: T[] | null };
    return body.meals ?? [];
  }
}

/** "Chicken breast" → "chicken_breast", the form TheMealDB filters by. */
function toQuery(ingredient: string): string {
  return ingredient.trim().toLowerCase().replace(/\s+/g, '_');
}

function toRecipe(meal: MealDetail): Recipe {
  const ingredients: string[] = [];
  for (let n = 1; n <= 20; n++) {
    const name = meal[`strIngredient${n}`]?.trim();
    if (!name) continue;
    const measure = meal[`strMeasure${n}`]?.trim();
    ingredients.push(measure ? `${measure} ${name}` : name);
  }
  return {
    id: meal.idMeal,
    title: meal.strMeal,
    url: `${BASE_URL}/meal/${meal.idMeal}`,
    ingredients,
    instructions: (meal.strInstructions ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_INSTRUCTIONS),
  };
}
