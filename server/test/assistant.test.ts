import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signedIn } from './helpers.js';
import type { DishSuggestion, FoodAssistant, Recipe, RecipeSource, StockLine } from '../src/assistant/application/assistant-service.js';
import { GeminiFoodAssistant, parseCategorizeResponse, parseDishesResponse } from '../src/assistant/infrastructure/gemini-food-assistant.js';

let app: FastifyInstance;
afterEach(() => app?.close());

type Request = Awaited<ReturnType<typeof signedIn>>;

const DISH: DishSuggestion = {
  title: 'Tortilla de patatas',
  description: 'Clásica y rápida',
  minutes: 30,
  uses: ['Huevos', 'Patatas'],
  missing: ['Cebolla'],
  steps: ['Pelar y freír las patatas', 'Batir los huevos y cuajar'],
  sourceUrl: null,
};

const RECIPE: Recipe = {
  id: '52772',
  title: 'Spanish Tortilla',
  url: 'https://www.themealdb.com/meal/52772',
  ingredients: ['4 Eggs', '2 Potatoes'],
  instructions: 'Fry the potatoes, add the eggs.',
};

/** Puts fruit in Frutas and leaves anything else unplaced; records what it was asked. */
type DishCall = { stock: StockLine[]; wish: string; recipes: Recipe[] };

function fakeAssistant(
  calls: { categorize: string[][]; dishes: DishCall[]; ingredients?: string[][] } = { categorize: [], dishes: [] },
  dishes: DishSuggestion[] = [DISH],
): FoodAssistant {
  return {
    async categorize(names, categories) {
      calls.categorize.push(names);
      expect(categories).toContain('Frutas');
      return names.map((name) => (['Manzana', 'Pera'].includes(name) ? 'frutas' : null));
    },
    async ingredientNames(names) {
      calls.ingredients?.push(names);
      return names.map((name) => (name === 'Huevos' ? 'eggs' : name.toLowerCase()));
    },
    async suggestDishes(stock, wish, recipes) {
      calls.dishes.push({ stock, wish, recipes });
      return dishes;
    },
  };
}

function fakeRecipes(asked: string[][], result: Recipe[] | Error = [RECIPE]): RecipeSource {
  return {
    async find(ingredients) {
      asked.push(ingredients);
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

async function addItem(request: Request, name: string, extra: Record<string, unknown> = {}) {
  return (await request({ method: 'POST', url: '/api/items', payload: { name, location: 'pantry', quantity: 2, unit: 'unit', ...extra } })).json();
}

function multipart() {
  const boundary = '----ks-test';
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="t.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('receipt categories', () => {
  it('maps the category the AI chose to one of the household categories, or none', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    const cats: { id: string; name: string }[] = (await ana({ method: 'GET', url: '/api/categories' })).json();
    const id = (name: string) => cats.find((c) => c.name === name)!.id;

    const { lines } = (await ana({ method: 'POST', url: '/api/receipts/read', ...multipart() })).json();
    expect(lines.map((l: { name: string; categoryId: string | null }) => [l.name, l.categoryId])).toEqual([
      ['Leche entera', id('Lácteos')],
      ['Pechuga de pollo', id('Proteínas')],
      ['Pan', null],
    ]);
  });

  it('gives the reader the household category names', async () => {
    let received: string[] = [];
    app = await createTestApp({
      async parse(_image, _mime, categories) {
        received = categories;
        return [];
      },
    });
    const ana = await signedIn(app);
    await ana({ method: 'POST', url: '/api/categories', payload: { name: 'Congelados' } });
    await ana({ method: 'POST', url: '/api/receipts/read', ...multipart() });
    expect(received).toContain('Congelados');
    expect(received).toContain('Proteínas');
  });

  it('stores the confirmed category; a merged item keeps its own and takes one only if it had none', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    const cats: { id: string; name: string }[] = (await ana({ method: 'GET', url: '/api/categories' })).json();
    const id = (name: string) => cats.find((c) => c.name === name)!.id;
    await addItem(ana, 'Leche', { unit: 'l', categoryId: id('Bebidas') });
    await addItem(ana, 'Arroz', { unit: 'kg' });

    const res = await ana({
      method: 'POST',
      url: '/api/receipts/confirm',
      payload: {
        lines: [
          { name: 'leche', quantity: 1, unit: 'l', location: 'pantry', categoryId: id('Lácteos') },
          { name: 'arroz', quantity: 1, unit: 'kg', location: 'pantry', categoryId: id('Cereales y pasta') },
          { name: 'Pollo', quantity: 1, unit: 'kg', location: 'fridge', categoryId: id('Proteínas') },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const items: { name: string; categoryId: string | null }[] = (await ana({ method: 'GET', url: '/api/items' })).json();
    const byName = Object.fromEntries(items.map((i) => [i.name, i.categoryId]));
    expect(byName).toEqual({ Leche: id('Bebidas'), Arroz: id('Cereales y pasta'), Pollo: id('Proteínas') });
  });
});

describe('AI classify button', () => {
  it('places only uncategorized items, never changes categorized ones and reports what is left', async () => {
    const calls = { categorize: [] as string[][], dishes: [] };
    app = await createTestApp(undefined, { foodAssistant: fakeAssistant(calls) });
    const ana = await signedIn(app);
    const cats: { id: string; name: string }[] = (await ana({ method: 'GET', url: '/api/categories' })).json();
    const fruit = cats.find((c) => c.name === 'Frutas')!.id;
    const drinks = cats.find((c) => c.name === 'Bebidas')!.id;
    await addItem(ana, 'Manzana');
    await addItem(ana, 'Tornillos');
    await addItem(ana, 'Pera', { categoryId: drinks });

    const res = await ana({ method: 'POST', url: '/api/items/categorize' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ categorized: 1, remaining: 1 });
    expect(calls.categorize).toEqual([['Manzana', 'Tornillos']]);

    const items: { name: string; categoryId: string | null }[] = (await ana({ method: 'GET', url: '/api/items' })).json();
    expect(Object.fromEntries(items.map((i) => [i.name, i.categoryId]))).toEqual({ Manzana: fruit, Tornillos: null, Pera: drinks });
  });

  it('does not call the AI when every item already has a category', async () => {
    const calls = { categorize: [] as string[][], dishes: [] };
    app = await createTestApp(undefined, { foodAssistant: fakeAssistant(calls) });
    const ana = await signedIn(app);
    expect((await ana({ method: 'POST', url: '/api/items/categorize' })).json()).toEqual({ categorized: 0, remaining: 0 });
    expect(calls.categorize).toEqual([]);
  });

  it('answers 503 without an AI and 502 when the AI fails', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    await addItem(ana, 'Manzana');
    expect((await ana({ method: 'GET', url: '/api/ai/status' })).json()).toEqual({ enabled: false });
    const disabled = await ana({ method: 'POST', url: '/api/items/categorize' });
    expect(disabled.statusCode).toBe(503);
    expect(disabled.json()).toEqual({ error: 'ai_disabled', message: 'La IA no está configurada en el servidor (falta GEMINI_API_KEY)' });
    await app.close();

    app = await createTestApp(undefined, {
      foodAssistant: {
        categorize: () => Promise.reject(new Error('quota')),
        ingredientNames: () => Promise.reject(new Error('quota')),
        suggestDishes: () => Promise.reject(new Error('quota')),
      },
    });
    const bea = await signedIn(app, 'bea');
    await addItem(bea, 'Manzana');
    expect((await bea({ method: 'GET', url: '/api/ai/status' })).json()).toEqual({ enabled: true });
    const failed = await bea({ method: 'POST', url: '/api/items/categorize' });
    expect(failed.statusCode).toBe(502);
    expect(failed.json()).toEqual({ error: 'ai_failed', message: 'La IA no ha respondido. Inténtalo de nuevo en un momento' });
  });
});

describe('dish suggestions', () => {
  it('suggests dishes from the available stock and the wish', async () => {
    const calls = { categorize: [], dishes: [] as DishCall[] };
    app = await createTestApp(undefined, { foodAssistant: fakeAssistant(calls) });
    const ana = await signedIn(app);
    await addItem(ana, 'Huevos', { location: 'fridge', quantity: 6 });
    await addItem(ana, 'Sal', { quantity: 0 });

    const res = await ana({ method: 'POST', url: '/api/dishes/suggest', payload: { wish: '  algo rápido ' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ dishes: [DISH] });
    expect(calls.dishes[0]).toEqual({ stock: [{ name: 'Huevos', available: 6, unit: 'unit', location: 'fridge' }], wish: 'algo rápido', recipes: [] });
  });

  it('gives the AI recipes from the recipe database that use the stock, in English', async () => {
    const calls = { categorize: [], dishes: [] as DishCall[], ingredients: [] as string[][] };
    const asked: string[][] = [];
    app = await createTestApp(undefined, { foodAssistant: fakeAssistant(calls), recipeSource: fakeRecipes(asked) });
    const ana = await signedIn(app);
    await addItem(ana, 'Huevos', { location: 'fridge', quantity: 6 });
    await addItem(ana, 'Patatas');

    expect((await ana({ method: 'POST', url: '/api/dishes/suggest', payload: {} })).statusCode).toBe(200);
    expect(calls.ingredients).toEqual([['Huevos', 'Patatas']]);
    expect(asked).toEqual([['eggs', 'patatas']]);
    expect(calls.dishes[0]!.recipes).toEqual([RECIPE]);
  });

  it('still suggests dishes when the recipe database fails', async () => {
    const calls = { categorize: [], dishes: [] as DishCall[] };
    app = await createTestApp(undefined, { foodAssistant: fakeAssistant(calls), recipeSource: fakeRecipes([], new Error('offline')) });
    const ana = await signedIn(app);
    await addItem(ana, 'Huevos');
    const res = await ana({ method: 'POST', url: '/api/dishes/suggest', payload: {} });
    expect(res.json()).toEqual({ dishes: [DISH] });
    expect(calls.dishes[0]!.recipes).toEqual([]);
  });

  it('asks again when fewer than 3 ideas can be made with what is at home, and keeps the better answer', async () => {
    const dish = (title: string, missing: string[]) => ({ ...DISH, title, missing });
    const fresh = [dish('A', ['x', 'y', 'z']), dish('B', ['x', 'y', 'z']), dish('C', []), dish('D', ['x', 'y', 'z'])];
    const matching = [dish('E', []), dish('F', ['x']), dish('G', ['x', 'y']), dish('H', ['x', 'y', 'z'])];
    const answers = [fresh, matching];
    const calls = { categorize: [], dishes: [] as DishCall[] };
    const assistant = fakeAssistant(calls);
    app = await createTestApp(undefined, { foodAssistant: { ...assistant, suggestDishes: async (...args) => (await assistant.suggestDishes(...args), answers.shift()!) } });
    const ana = await signedIn(app);
    await addItem(ana, 'Huevos');
    const titles = (await ana({ method: 'POST', url: '/api/dishes/suggest', payload: {} })).json().dishes.map((d: DishSuggestion) => d.title);
    expect(calls.dishes).toHaveLength(2);
    expect(titles).toEqual(['E', 'F', 'G', 'H']);
  });

  it('does not ask again when at least 3 ideas can be made with what is at home', async () => {
    const dish = (title: string, missing: string[]) => ({ ...DISH, title, missing });
    const calls = { categorize: [], dishes: [] as DishCall[] };
    app = await createTestApp(undefined, { foodAssistant: fakeAssistant(calls, [dish('A', []), dish('B', ['x', 'y']), dish('C', ['x']), dish('D', ['a', 'b', 'c'])]) });
    const ana = await signedIn(app);
    await addItem(ana, 'Huevos');
    await ana({ method: 'POST', url: '/api/dishes/suggest', payload: {} });
    expect(calls.dishes).toHaveLength(1);
  });

  it('shows first the dishes that need the fewest things to buy', async () => {
    const dish = (title: string, missing: string[]) => ({ ...DISH, title, missing });
    const dishes = [dish('Fresca', ['Tofu', 'Jengibre', 'Soja']), dish('Completa', []), dish('Casi', ['Cebolla']), dish('También completa', [])];
    app = await createTestApp(undefined, { foodAssistant: fakeAssistant(undefined, dishes) });
    const ana = await signedIn(app);
    await addItem(ana, 'Huevos');
    const titles = (await ana({ method: 'POST', url: '/api/dishes/suggest', payload: {} })).json().dishes.map((d: DishSuggestion) => d.title);
    expect(titles).toEqual(['Completa', 'También completa', 'Casi', 'Fresca']);
  });

  it('asks for food first when nothing is available', async () => {
    app = await createTestApp(undefined, { foodAssistant: fakeAssistant() });
    const ana = await signedIn(app);
    const res = await ana({ method: 'POST', url: '/api/dishes/suggest', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'no_stock', message: 'Añade alimentos para recibir ideas de platos' });
  });

  it('answers 503 without an AI', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    await addItem(ana, 'Huevos');
    expect((await ana({ method: 'POST', url: '/api/dishes/suggest', payload: {} })).statusCode).toBe(503);
  });
});

describe('Gemini response parsing', () => {
  it('keeps one answer per name, in order, and nulls anything missing or malformed', () => {
    expect(parseCategorizeResponse(JSON.stringify({ items: [{ index: 1, category: 'Frutas' }, { index: 0, category: '' }, { index: 7, category: 'X' }] }), 3)).toEqual([
      null,
      'Frutas',
      null,
    ]);
    expect(parseCategorizeResponse('not json', 2)).toEqual([null, null]);
  });

  it('drops malformed dishes', () => {
    const dishes = parseDishesResponse(
      JSON.stringify({ dishes: [DISH, { title: '', description: 'x', minutes: 5, uses: [], missing: [], steps: [] }, { title: 'Solo título' }] }),
    );
    expect(dishes).toEqual([DISH]);
  });
});

describe('GeminiFoodAssistant', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubGemini(answer: unknown, bodies: string[], urls: string[]) {
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      urls.push(input instanceof Request ? input.url : String(input));
      bodies.push(String(init?.body ?? ''));
      const text = JSON.stringify(answer);
      return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] }), { headers: { 'content-type': 'application/json' } });
    });
  }

  it('categorizes through the v1beta endpoint, sending the names and the categories', async () => {
    const bodies: string[] = [];
    const urls: string[] = [];
    stubGemini({ items: [{ index: 0, category: 'Frutas' }] }, bodies, urls);
    const answers = await new GeminiFoodAssistant('k', 'gemini-2.5-flash').categorize(['Manzana', 'Clavos'], ['Frutas', 'Verduras']);
    expect(answers).toEqual(['Frutas', null]);
    expect(urls[0]).toContain('/v1beta/models/gemini-2.5-flash:generateContent');
    expect(bodies[0]).toContain('Manzana');
    expect(bodies[0]).toContain('Verduras');
  });

  function stubOverloaded(failures: number, urls: string[]) {
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      urls.push(input instanceof Request ? input.url : String(input));
      if (urls.length <= failures) {
        const error = { error: { code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE' } };
        return new Response(JSON.stringify(error), { status: 503, headers: { 'content-type': 'application/json' } });
      }
      const text = JSON.stringify({ items: [{ index: 0, category: 'Frutas' }] });
      return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] }), { headers: { 'content-type': 'application/json' } });
    });
  }

  const noWait = { sleep: async () => {} };

  it('retries the same model when Gemini is overloaded', async () => {
    const urls: string[] = [];
    stubOverloaded(2, urls);
    const answers = await new GeminiFoodAssistant('k', 'gemini-2.5-flash', { fallbackModel: 'gemini-2.5-flash-lite', ...noWait }).categorize(['Manzana'], ['Frutas']);
    expect(answers).toEqual(['Frutas']);
    expect(urls).toHaveLength(3);
    expect(urls.every((url) => url.includes('/models/gemini-2.5-flash:'))).toBe(true);
  });

  it('moves to the fallback model when the main one stays overloaded', async () => {
    const urls: string[] = [];
    stubOverloaded(3, urls);
    const answers = await new GeminiFoodAssistant('k', 'gemini-2.5-flash', { fallbackModel: 'gemini-2.5-flash-lite', ...noWait }).categorize(['Manzana'], ['Frutas']);
    expect(answers).toEqual(['Frutas']);
    expect(urls).toHaveLength(4);
    expect(urls[3]).toContain('/models/gemini-2.5-flash-lite:');
  });

  it('gives up with the overload error when every model stays overloaded', async () => {
    const urls: string[] = [];
    stubOverloaded(100, urls);
    const assistant = new GeminiFoodAssistant('k', 'gemini-2.5-flash', { fallbackModel: 'gemini-2.5-flash-lite', ...noWait });
    await expect(assistant.categorize(['Manzana'], ['Frutas'])).rejects.toMatchObject({ status: 503 });
    expect(urls).toHaveLength(6);
  });

  it('does not retry an error that is not an overload', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      urls.push(String(input instanceof Request ? input.url : input));
      return new Response(JSON.stringify({ error: { code: 400, message: 'bad', status: 'INVALID_ARGUMENT' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    });
    const assistant = new GeminiFoodAssistant('k', 'gemini-2.5-flash', { fallbackModel: 'gemini-2.5-flash-lite', ...noWait });
    await expect(assistant.categorize(['Manzana'], ['Frutas'])).rejects.toMatchObject({ status: 400 });
    expect(urls).toHaveLength(1);
  });

  it('suggests dishes from the stock and passes the wish along', async () => {
    const bodies: string[] = [];
    stubGemini({ dishes: [{ ...DISH, recipeId: '' }] }, bodies, []);
    const dishes = await new GeminiFoodAssistant('k', 'm').suggestDishes([{ name: 'Huevos', available: 6, unit: 'unit', location: 'fridge' }], 'cena ligera', []);
    expect(dishes).toEqual([DISH]);
    expect(bodies[0]).toContain('Huevos');
    expect(bodies[0]).toContain('cena ligera');
    expect(bodies[0]).toContain('At least 3 of them must be made with the available food');
  });

  it('sends the recipes as inspiration and links each dish to the recipe it adapts', async () => {
    const bodies: string[] = [];
    stubGemini({ dishes: [{ ...DISH, recipeId: '52772' }, { ...DISH, title: 'Otra', recipeId: '999' }] }, bodies, []);
    const dishes = await new GeminiFoodAssistant('k', 'm').suggestDishes([{ name: 'Huevos', available: 6, unit: 'unit', location: 'fridge' }], '', [RECIPE]);
    expect(dishes).toEqual([
      { ...DISH, sourceUrl: RECIPE.url },
      { ...DISH, title: 'Otra', sourceUrl: null },
    ]);
    expect(bodies[0]).toContain('Spanish Tortilla');
  });

  it('turns food names into English ingredient names for the recipe database', async () => {
    const bodies: string[] = [];
    stubGemini({ ingredients: ['eggs', ' potatoes ', '', 'eggs'] }, bodies, []);
    const names = await new GeminiFoodAssistant('k', 'm').ingredientNames(['Huevos', 'Patatas']);
    expect(names).toEqual(['eggs', 'potatoes']);
    expect(bodies[0]).toContain('Patatas');
  });
});
