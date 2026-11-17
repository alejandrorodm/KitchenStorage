import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signedIn } from './helpers.js';

let app: FastifyInstance;
afterEach(() => app?.close());

async function setup() {
  app = await createTestApp();
  const request = await signedIn(app);
  const list = async () => (await request({ method: 'GET', url: '/api/shopping' })).json();
  return { request, list };
}

describe('alerts and shopping list', () => {
  it('adds a low or empty item to the shopping list and alerts once', async () => {
    const { request, list } = await setup();
    const milk = (
      await request({ method: 'POST', url: '/api/items', payload: { name: 'Leche', location: 'pantry', quantity: 3, unit: 'l', lowThreshold: 1 } })
    ).json();
    expect(await list()).toEqual([]);

    await request({ method: 'POST', url: `/api/items/${milk.id}/adjust`, payload: { delta: -2 } });
    const alerts = (await request({ method: 'GET', url: '/api/alerts' })).json();
    expect(alerts).toMatchObject([{ id: milk.id, status: 'low' }]);
    expect(await list()).toMatchObject([{ name: 'Leche', source: 'auto', foodItemId: milk.id, status: 'low', checked: false }]);

    await request({ method: 'POST', url: `/api/items/${milk.id}/adjust`, payload: { delta: -1 } });
    expect(await list()).toMatchObject([{ status: 'out' }]);
    expect(await list()).toHaveLength(1);
  });

  it('alerts when planned meals would use up an item', async () => {
    const { request, list } = await setup();
    const rice = (
      await request({ method: 'POST', url: '/api/items', payload: { name: 'Arroz', location: 'pantry', quantity: 1, unit: 'kg', lowThreshold: 0.2 } })
    ).json();
    await request({ method: 'PUT', url: '/api/meals/2026-11-18/lunch', payload: { allocations: [{ foodItemId: rice.id, quantity: 1 }] } });
    expect((await request({ method: 'GET', url: '/api/alerts' })).json()).toMatchObject([{ id: rice.id, status: 'out' }]);
    expect(await list()).toHaveLength(1);
  });

  it('removes a pending automatic entry once the item is restocked', async () => {
    const { request, list } = await setup();
    const milk = (
      await request({ method: 'POST', url: '/api/items', payload: { name: 'Leche', location: 'pantry', quantity: 0, unit: 'l' } })
    ).json();
    expect(await list()).toHaveLength(1);
    await request({ method: 'POST', url: `/api/items/${milk.id}/adjust`, payload: { delta: 6 } });
    expect(await list()).toEqual([]);
    expect((await request({ method: 'GET', url: '/api/alerts' })).json()).toEqual([]);
  });

  it('re-adds an item that runs out again after its checked entry was restocked', async () => {
    const { request, list } = await setup();
    const milk = (
      await request({ method: 'POST', url: '/api/items', payload: { name: 'Leche', location: 'pantry', quantity: 0, unit: 'l' } })
    ).json();
    const [entry] = await list();
    await request({ method: 'PATCH', url: `/api/shopping/${entry.id}`, payload: { checked: true } });

    await request({ method: 'POST', url: `/api/items/${milk.id}/adjust`, payload: { delta: 6 } });
    expect(await list()).toEqual([]);

    await request({ method: 'POST', url: `/api/items/${milk.id}/adjust`, payload: { delta: -6 } });
    expect(await list()).toMatchObject([{ foodItemId: milk.id, checked: false, status: 'out' }]);
  });

  it('re-adds a still-low item after its checked entry is cleared', async () => {
    const { request, list } = await setup();
    await request({ method: 'POST', url: '/api/items', payload: { name: 'Leche', location: 'pantry', quantity: 0, unit: 'l' } });
    const [entry] = await list();
    await request({ method: 'PATCH', url: `/api/shopping/${entry.id}`, payload: { checked: true } });
    await request({ method: 'POST', url: '/api/shopping/clear-checked' });
    expect(await list()).toMatchObject([{ name: 'Leche', checked: false }]);
  });

  it('manages manual entries: add, check, clear checked and delete', async () => {
    const { request, list } = await setup();
    const bread = (await request({ method: 'POST', url: '/api/shopping', payload: { name: 'Pan', quantity: 2, unit: 'unit' } })).json();
    const salt = (await request({ method: 'POST', url: '/api/shopping', payload: { name: 'Sal' } })).json();
    expect(bread).toMatchObject({ name: 'Pan', quantity: 2, source: 'manual', checked: false, status: null });

    expect((await request({ method: 'PATCH', url: `/api/shopping/${bread.id}`, payload: { checked: true } })).json()).toMatchObject({
      checked: true,
    });
    expect((await request({ method: 'POST', url: '/api/shopping/clear-checked' })).json()).toEqual({ removed: 1 });
    expect(await list()).toMatchObject([{ id: salt.id }]);

    expect((await request({ method: 'DELETE', url: `/api/shopping/${salt.id}` })).statusCode).toBe(204);
    expect((await request({ method: 'DELETE', url: `/api/shopping/${salt.id}` })).statusCode).toBe(404);
  });

  it('drops the automatic entry when its food item is deleted', async () => {
    const { request, list } = await setup();
    const milk = (
      await request({ method: 'POST', url: '/api/items', payload: { name: 'Leche', location: 'pantry', quantity: 0, unit: 'l' } })
    ).json();
    await request({ method: 'DELETE', url: `/api/items/${milk.id}` });
    expect(await list()).toEqual([]);
  });
});
