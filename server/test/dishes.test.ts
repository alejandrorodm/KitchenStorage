import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signedIn } from './helpers.js';
import { MIGRATIONS, migrate } from '../src/shared/db.js';
import { DishService, type DishRepository } from '../src/dishes/application/dish-service.js';

let app: FastifyInstance;
afterEach(() => app?.close());

const TORTILLA = {
  title: 'Tortilla de patatas',
  description: 'La de siempre',
  minutes: 40,
  ingredients: ['Huevos', 'Patatas', 'Cebolla'],
  steps: ['Pela y corta las patatas', 'Fríelas', 'Mézclalas con el huevo y cuaja'],
  sourceUrl: null,
};

describe('my dishes', () => {
  it('starts empty, then creates, lists, edits and deletes dishes', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    expect((await ana({ method: 'GET', url: '/api/dishes' })).json()).toEqual([]);

    const created = await ana({ method: 'POST', url: '/api/dishes', payload: TORTILLA });
    expect(created.statusCode).toBe(201);
    const dish = created.json();
    expect(dish).toMatchObject(TORTILLA);
    expect(dish.id).toEqual(expect.any(String));

    expect((await ana({ method: 'GET', url: '/api/dishes' })).json()).toEqual([dish]);

    const edited = await ana({ method: 'PATCH', url: `/api/dishes/${dish.id}`, payload: { title: 'Tortilla con cebolla', minutes: null } });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({ ...TORTILLA, id: dish.id, title: 'Tortilla con cebolla', minutes: null });

    expect((await ana({ method: 'DELETE', url: `/api/dishes/${dish.id}` })).statusCode).toBe(204);
    expect((await ana({ method: 'DELETE', url: `/api/dishes/${dish.id}` })).statusCode).toBe(404);
    expect((await ana({ method: 'GET', url: '/api/dishes' })).json()).toEqual([]);
  });

  it('only needs a title; the rest defaults to empty', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    const res = await ana({ method: 'POST', url: '/api/dishes', payload: { title: '  Lentejas  ' } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ title: 'Lentejas', description: '', minutes: null, ingredients: [], steps: [], sourceUrl: null });
  });

  it('rejects an empty title and a repeated one', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    expect((await ana({ method: 'POST', url: '/api/dishes', payload: { title: ' ' } })).statusCode).toBe(400);
    await ana({ method: 'POST', url: '/api/dishes', payload: TORTILLA });
    const repeated = await ana({ method: 'POST', url: '/api/dishes', payload: { title: 'tortilla de PATATAS' } });
    expect(repeated.statusCode).toBe(409);
    expect(repeated.json()).toEqual({ error: 'conflict', message: 'Ya tienes un plato llamado «tortilla de PATATAS»' });
  });

  it('accepts an AI idea with many ingredients (30 at home + 30 to buy)', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    const ingredients = Array.from({ length: 60 }, (_, n) => `Ingrediente ${n}`);
    expect((await ana({ method: 'POST', url: '/api/dishes', payload: { title: 'Cocido', ingredients } })).statusCode).toBe(201);
  });

  it('answers a repeated title with 409 even when two saves race past the check', () => {
    const racing: DishRepository = {
      list: () => [],
      get: () => undefined,
      findByKey: () => undefined,
      insert: () => {
        throw Object.assign(new Error('UNIQUE constraint failed: dishes.household_id, dishes.title_key'), { code: 'ERR_SQLITE_ERROR' });
      },
      update: () => {},
      delete: () => false,
    };
    const service = new DishService(racing, () => {});
    expect(() => service.create({ ...TORTILLA })).toThrow(expect.objectContaining({ statusCode: 409, message: 'Ya tienes un plato llamado «Tortilla de patatas»' }));
  });

  it('lists dishes alphabetically', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    for (const title of ['Paella', 'Ensalada', 'Ñoquis', 'albóndigas']) await ana({ method: 'POST', url: '/api/dishes', payload: { title } });
    const titles = (await ana({ method: 'GET', url: '/api/dishes' })).json().map((d: { title: string }) => d.title);
    expect(titles).toEqual(['albóndigas', 'Ensalada', 'Ñoquis', 'Paella']);
  });

  it("keeps each household's dishes to itself", async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    const bea = await signedIn(app, 'bea');
    const dish = (await ana({ method: 'POST', url: '/api/dishes', payload: TORTILLA })).json();
    expect((await bea({ method: 'GET', url: '/api/dishes' })).json()).toEqual([]);
    expect((await bea({ method: 'PATCH', url: `/api/dishes/${dish.id}`, payload: { title: 'X' } })).statusCode).toBe(404);
    expect((await bea({ method: 'DELETE', url: `/api/dishes/${dish.id}` })).statusCode).toBe(404);
    expect((await bea({ method: 'POST', url: '/api/dishes', payload: TORTILLA })).statusCode).toBe(201);
  });

  it('tells the household devices when dishes change', async () => {
    app = await createTestApp();
    const ana = await signedIn(app);
    const me = (await ana({ method: 'GET', url: '/api/auth/me' })).json();
    const received: string[][] = [];
    app.changeEvents.subscribe(me.householdId, (topics) => received.push(topics));
    await ana({ method: 'POST', url: '/api/dishes', payload: TORTILLA });
    expect(received).toEqual([['dishes']]);
  });

  it('migration adds the dishes table to an existing database', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const migration of MIGRATIONS.slice(0, 5)) typeof migration === 'string' ? db.exec(migration) : migration(db);
    db.exec('PRAGMA user_version = 5');
    migrate(db);
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length });
    expect(db.prepare('SELECT COUNT(*) AS n FROM dishes').get()).toEqual({ n: 0 });
  });
});
