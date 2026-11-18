import { afterEach, describe, expect, it, vi } from 'vitest';
import { TheMealDbRecipeSource } from '../src/assistant/infrastructure/themealdb-recipe-source.js';

const meal = (id: string, name: string) => ({ idMeal: id, strMeal: name, strMealThumb: 'x' });

function detail(id: string, name: string) {
  return {
    idMeal: id,
    strMeal: name,
    strInstructions: 'Cook it.\r\nServe.',
    strIngredient1: 'Eggs',
    strMeasure1: '4',
    strIngredient2: 'Potatoes',
    strMeasure2: ' 2 large ',
    strIngredient3: '',
    strMeasure3: ' ',
    strIngredient4: null,
    strMeasure4: null,
  };
}

/** Answers like TheMealDB: filter lists by ingredient, lookup gives one meal. */
function stubMealDb(byIngredient: Record<string, ReturnType<typeof meal>[] | 'fail'>, urls: string[]) {
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    urls.push(url.href);
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    if (url.pathname.endsWith('/filter.php')) {
      const meals = byIngredient[url.searchParams.get('i') ?? ''];
      if (meals === 'fail') return new Response('down', { status: 500 });
      return json({ meals: meals ?? null });
    }
    const id = url.searchParams.get('i')!;
    return json({ meals: [detail(id, `Meal ${id}`)] });
  });
}

describe('TheMealDbRecipeSource', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('looks up the meals that share the most ingredients with the stock first', async () => {
    const urls: string[] = [];
    stubMealDb({ eggs: [meal('1', 'A'), meal('2', 'B')], potatoes: [meal('2', 'B'), meal('3', 'C')], cheese: [meal('2', 'B'), meal('3', 'C')] }, urls);
    const recipes = await new TheMealDbRecipeSource({ limit: 2, random: () => 0.5 }).find(['eggs', 'potatoes', 'cheese']);

    expect(recipes.map((r) => r.id)).toEqual(['2', '3']);
    expect(recipes[0]).toEqual({
      id: '2',
      title: 'Meal 2',
      url: 'https://www.themealdb.com/meal/2',
      ingredients: ['4 Eggs', '2 large Potatoes'],
      instructions: 'Cook it.\nServe.',
    });
    expect(urls[0]).toBe('https://www.themealdb.com/api/json/v1/1/filter.php?i=eggs');
  });

  it('queries ingredients with underscores, once each', async () => {
    const urls: string[] = [];
    stubMealDb({ chicken_breast: [meal('7', 'Pollo')] }, urls);
    const recipes = await new TheMealDbRecipeSource().find(['Chicken breast', 'chicken breast']);
    expect(recipes.map((r) => r.id)).toEqual(['7']);
    expect(urls.filter((u) => u.includes('filter.php'))).toEqual(['https://www.themealdb.com/api/json/v1/1/filter.php?i=chicken_breast']);
  });

  it('skips ingredients whose search fails and returns nothing when nothing matches', async () => {
    stubMealDb({ eggs: 'fail', rice: [meal('9', 'Arroz')] }, []);
    expect((await new TheMealDbRecipeSource().find(['eggs', 'rice'])).map((r) => r.id)).toEqual(['9']);
    expect(await new TheMealDbRecipeSource().find(['unicorn'])).toEqual([]);
  });

  it('mixes meals that tie so asking again gives other ideas', async () => {
    stubMealDb({ eggs: [meal('1', 'A'), meal('2', 'B'), meal('3', 'C')] }, []);
    const order = [0.9, 0.1, 0.5];
    const recipes = await new TheMealDbRecipeSource({ limit: 3, random: () => order.shift()! }).find(['eggs']);
    expect(recipes.map((r) => r.id)).toEqual(['2', '3', '1']);
  });
});
