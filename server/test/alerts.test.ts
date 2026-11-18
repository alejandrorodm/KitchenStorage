import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { MIGRATIONS, migrate } from '../src/shared/db.js';
import { createTestApp, signedIn } from './helpers.js';

let app: FastifyInstance;
afterEach(() => app?.close());

const milk = { name: 'Leche', location: 'pantry', quantity: 1, unit: 'l' };

describe('household alert threshold', () => {
  it('by default alerts only when an item runs out', async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    expect((await ana({ method: 'GET', url: '/api/household' })).json()).toMatchObject({ lowThreshold: 0 });

    const item = (await ana({ method: 'POST', url: '/api/items', payload: milk })).json();
    expect(item).toMatchObject({ lowThreshold: null, alertAt: 0, status: 'ok' });
    expect((await ana({ method: 'GET', url: '/api/shopping' })).json()).toEqual([]);

    const empty = (await ana({ method: 'POST', url: `/api/items/${item.id}/adjust`, payload: { delta: -1 } })).json();
    expect(empty).toMatchObject({ available: 0, status: 'out' });
    expect((await ana({ method: 'GET', url: '/api/shopping' })).json()).toMatchObject([{ name: 'Leche', source: 'auto', status: 'out' }]);
  });

  it('applies the household setting to items that follow it, not to items with their own value', async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    const bob = await signedIn(app, 'bob');
    const following = (await ana({ method: 'POST', url: '/api/items', payload: milk })).json();
    const own = (await ana({ method: 'POST', url: '/api/items', payload: { ...milk, name: 'Arroz', unit: 'kg', lowThreshold: 0 } })).json();
    const bobs = (await bob({ method: 'POST', url: '/api/items', payload: milk })).json();

    const res = await ana({ method: 'PATCH', url: '/api/household', payload: { lowThreshold: 2 } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ lowThreshold: 2 });

    const items = (await ana({ method: 'GET', url: '/api/items' })).json() as { id: string }[];
    expect(items.find((i) => i.id === following.id)).toMatchObject({ lowThreshold: null, alertAt: 2, status: 'low' });
    expect(items.find((i) => i.id === own.id)).toMatchObject({ lowThreshold: 0, alertAt: 0, status: 'ok' });
    expect((await ana({ method: 'GET', url: '/api/shopping' })).json()).toMatchObject([{ foodItemId: following.id, source: 'auto', status: 'low' }]);

    // Another household keeps its own setting.
    expect((await bob({ method: 'GET', url: `/api/items` })).json()).toMatchObject([{ id: bobs.id, alertAt: 0, status: 'ok' }]);
    expect((await bob({ method: 'GET', url: '/api/shopping' })).json()).toEqual([]);

    // Back to 0: the automatic entry goes away.
    await ana({ method: 'PATCH', url: '/api/household', payload: { lowThreshold: 0 } });
    expect((await ana({ method: 'GET', url: '/api/shopping' })).json()).toEqual([]);
  });

  it('rejects an invalid household setting and leaves it unchanged', async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    for (const payload of [{ lowThreshold: -1 }, { lowThreshold: 'x' }, {}]) {
      expect((await ana({ method: 'PATCH', url: '/api/household', payload })).statusCode).toBe(400);
    }
    expect((await ana({ method: 'GET', url: '/api/household' })).json()).toMatchObject({ lowThreshold: 0 });
    expect((await app.inject({ method: 'PATCH', url: '/api/household', payload: { lowThreshold: 1 } })).statusCode).toBe(401);
  });

  it('lets an item go back to following the household with null', async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    const item = (await ana({ method: 'POST', url: '/api/items', payload: { ...milk, lowThreshold: 3 } })).json();
    expect(item).toMatchObject({ lowThreshold: 3, alertAt: 3, status: 'low' });

    const reset = (await ana({ method: 'PATCH', url: `/api/items/${item.id}`, payload: { lowThreshold: null } })).json();
    expect(reset).toMatchObject({ lowThreshold: null, alertAt: 0, status: 'ok' });
    expect((await ana({ method: 'GET', url: '/api/shopping' })).json()).toEqual([]);
  });

  it('migrates existing items to follow the household (0) and drops automatic entries that no longer apply', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(MIGRATIONS[0] as string);
    db.exec('PRAGMA user_version = 1');
    db.exec(`
      INSERT INTO users VALUES ('u1', 'old', 'scrypt:x:y', '2026-01-01');
      INSERT INTO food_items VALUES ('f1', 'Leche', 'leche', 'fridge', 1, 'l', 1, '2026-01-01', '2026-01-01');
      INSERT INTO food_items VALUES ('f2', 'Arroz', 'arroz', 'pantry', 0, 'kg', 1, '2026-01-01', '2026-01-01');
      INSERT INTO meals VALUES ('m1', '2026-01-02', 'lunch', 'Café', 0);
      INSERT INTO meal_allocations VALUES ('a1', 'm1', 'f1', 0.5, 0);
      INSERT INTO shopping_items VALUES ('s1', 'Leche', NULL, 'l', 'f1', 'auto', 0, '2026-01-01');
      INSERT INTO shopping_items VALUES ('s2', 'Arroz', NULL, 'kg', 'f2', 'auto', 0, '2026-01-01');
      INSERT INTO shopping_items VALUES ('s3', 'Pan', NULL, NULL, NULL, 'manual', 0, '2026-01-01');
    `);

    migrate(db);

    expect(db.prepare('SELECT low_threshold AS t FROM households').all()).toEqual([{ t: 0 }]);
    expect(db.prepare('SELECT id, quantity, low_threshold AS t FROM food_items ORDER BY id').all()).toEqual([
      { id: 'f1', quantity: 1, t: null },
      { id: 'f2', quantity: 0, t: null },
    ]);
    expect(db.prepare('SELECT id FROM shopping_items ORDER BY id').all()).toEqual([{ id: 's2' }, { id: 's3' }]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM meal_allocations').get()).toEqual({ n: 1 });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(() => db.exec("UPDATE food_items SET low_threshold = -1 WHERE id = 'f1'")).toThrow();
  });
});
