import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signedIn } from './helpers.js';
import { DEFAULT_CATEGORIES } from '../src/categories/domain/category.js';
import { MIGRATIONS, migrate } from '../src/shared/db.js';

let app: FastifyInstance;
afterEach(() => app?.close());

type Request = Awaited<ReturnType<typeof signedIn>>;

async function categories(request: Request): Promise<{ id: string; name: string }[]> {
  return (await request({ method: 'GET', url: '/api/categories' })).json();
}

async function categoryId(request: Request, name: string): Promise<string> {
  const found = (await categories(request)).find((c) => c.name === name);
  if (!found) throw new Error(`no category ${name}`);
  return found.id;
}

describe('categories', () => {
  it('starts every new household with the basic categories', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    const names = (await categories(ana)).map((c) => c.name);
    expect([...names].sort()).toEqual([...DEFAULT_CATEGORIES].sort());
    expect(names).toEqual(expect.arrayContaining(['Proteínas', 'Verduras', 'Frutas']));
  });

  it('creates, renames and deletes categories, and rejects duplicate names', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);

    const created = await ana({ method: 'POST', url: '/api/categories', payload: { name: ' Congelados ' } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: 'Congelados' });

    const duplicate = await ana({ method: 'POST', url: '/api/categories', payload: { name: 'proteinas' } });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: 'conflict', message: 'Ya existe una sección llamada «proteinas»' });

    const renamed = await ana({ method: 'PATCH', url: `/api/categories/${created.json().id}`, payload: { name: 'Precocinados' } });
    expect(renamed.json()).toMatchObject({ id: created.json().id, name: 'Precocinados' });
    const clash = await ana({ method: 'PATCH', url: `/api/categories/${created.json().id}`, payload: { name: 'Frutas' } });
    expect(clash.statusCode).toBe(409);

    expect((await ana({ method: 'DELETE', url: `/api/categories/${created.json().id}` })).statusCode).toBe(204);
    expect((await ana({ method: 'DELETE', url: `/api/categories/${created.json().id}` })).statusCode).toBe(404);
    expect((await categories(ana)).map((c) => c.name)).not.toContain('Precocinados');
  });

  it('rejects an empty name', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    const res = await ana({ method: 'POST', url: '/api/categories', payload: { name: '  ' } });
    expect(res.statusCode).toBe(400);
  });

  it('assigns items to a category and leaves them without one when it is deleted', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    const fruit = await categoryId(ana, 'Frutas');

    const apple = await ana({ method: 'POST', url: '/api/items', payload: { name: 'Manzana', location: 'pantry', quantity: 3, unit: 'unit', categoryId: fruit } });
    expect(apple.statusCode).toBe(201);
    expect(apple.json()).toMatchObject({ categoryId: fruit });

    const plain = await ana({ method: 'POST', url: '/api/items', payload: { name: 'Sal', location: 'pantry', quantity: 1, unit: 'kg' } });
    expect(plain.json()).toMatchObject({ categoryId: null });

    const moved = await ana({ method: 'PATCH', url: `/api/items/${plain.json().id}`, payload: { categoryId: fruit } });
    expect(moved.json()).toMatchObject({ categoryId: fruit });
    const cleared = await ana({ method: 'PATCH', url: `/api/items/${plain.json().id}`, payload: { categoryId: null } });
    expect(cleared.json()).toMatchObject({ categoryId: null });

    await ana({ method: 'DELETE', url: `/api/categories/${fruit}` });
    const items = (await ana({ method: 'GET', url: '/api/items' })).json();
    expect(items.find((i: { name: string }) => i.name === 'Manzana')).toMatchObject({ categoryId: null, quantity: 3 });
  });

  it("does not let a household use or see another household's categories", async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    const bea = await signedIn(app, 'bea');
    const anaFruit = await categoryId(ana, 'Frutas');

    const res = await bea({ method: 'POST', url: '/api/items', payload: { name: 'Pera', location: 'pantry', quantity: 1, unit: 'unit', categoryId: anaFruit } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'unknown_category', message: 'Esa sección no existe' });
    expect((await bea({ method: 'DELETE', url: `/api/categories/${anaFruit}` })).statusCode).toBe(404);
    expect((await bea({ method: 'PATCH', url: `/api/categories/${anaFruit}`, payload: { name: 'X' } })).statusCode).toBe(404);
    expect((await categories(bea)).map((c) => c.id)).not.toContain(anaFruit);
  });

  it('publishes an inventory change event when categories change', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    const me = (await ana({ method: 'GET', url: '/api/auth/me' })).json();
    const received: string[][] = [];
    app.changeEvents.subscribe(me.householdId, (topics) => received.push(topics));
    await ana({ method: 'POST', url: '/api/categories', payload: { name: 'Congelados' } });
    expect(received).toEqual([['inventory']]);
  });

  it('migration adds the basic categories to existing households and keeps their items', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(MIGRATIONS[0] as string);
    db.exec('PRAGMA user_version = 1');
    db.exec(`
      INSERT INTO users VALUES ('u1', 'old', 'scrypt:x:y', '2026-01-01');
      INSERT INTO food_items VALUES ('f1', 'Leche', 'leche', 'fridge', 1, 'l', 1, '2026-01-01', '2026-01-01');
    `);

    migrate(db);

    const names = db.prepare("SELECT name FROM categories WHERE household_id = 'legacy'").all().map((r) => (r as { name: string }).name);
    expect(names.sort()).toEqual([...DEFAULT_CATEGORIES].sort());
    expect(db.prepare('SELECT id, quantity, category_id FROM food_items').all()).toEqual([{ id: 'f1', quantity: 1, category_id: null }]);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
