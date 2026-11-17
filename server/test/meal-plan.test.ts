import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signedIn } from './helpers.js';

let app: FastifyInstance;
afterEach(() => app?.close());

async function setup() {
  app = await createTestApp();
  const request = await signedIn(app);
  const create = async (name: string, quantity: number, lowThreshold = 1) =>
    (await request({ method: 'POST', url: '/api/items', payload: { name, location: 'fridge', quantity, unit: 'unit', lowThreshold } })).json();
  const item = async (id: string) => (await request({ method: 'GET', url: '/api/items' })).json().find((i: { id: string }) => i.id === id);
  return { request, create, item };
}

describe('meal planner', () => {
  it('plans breakfast, lunch and dinner and lists them for the week', async () => {
    const { request, create } = await setup();
    const eggs = await create('Huevos', 12);
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const res = await request({
        method: 'PUT',
        url: `/api/meals/2026-11-18/${mealType}`,
        payload: { title: mealType, allocations: [{ foodItemId: eggs.id, quantity: 1 }] },
      });
      expect(res.statusCode).toBe(200);
    }
    const week = await request({ method: 'GET', url: '/api/meals?from=2026-11-16&to=2026-11-22' });
    expect(week.json().map((m: { mealType: string }) => m.mealType).sort()).toEqual(['breakfast', 'dinner', 'lunch']);
    expect((await request({ method: 'GET', url: '/api/meals?from=2026-11-23&to=2026-11-29' })).json()).toEqual([]);
  });

  it('subtracts planned food from the available count without touching stock', async () => {
    const { request, create, item } = await setup();
    const eggs = await create('Huevos', 6, 2);
    await request({
      method: 'PUT',
      url: '/api/meals/2026-11-18/dinner',
      payload: { title: 'Tortilla', allocations: [{ foodItemId: eggs.id, quantity: 3 }, { foodItemId: eggs.id, quantity: 1 }] },
    });
    expect(await item(eggs.id)).toMatchObject({ quantity: 6, planned: 4, available: 2, status: 'low' });
  });

  it('replaces the allocations when the same slot is saved again', async () => {
    const { request, create, item } = await setup();
    const eggs = await create('Huevos', 6);
    const url = '/api/meals/2026-11-18/lunch';
    await request({ method: 'PUT', url, payload: { allocations: [{ foodItemId: eggs.id, quantity: 4 }] } });
    const saved = await request({ method: 'PUT', url, payload: { allocations: [{ foodItemId: eggs.id, quantity: 1 }] } });
    expect(saved.json().allocations).toHaveLength(1);
    expect(await item(eggs.id)).toMatchObject({ planned: 1, available: 5 });
  });

  it('deducts stock when the meal is eaten and restores it on undo', async () => {
    const { request, create, item } = await setup();
    const eggs = await create('Huevos', 6);
    const meal = (
      await request({ method: 'PUT', url: '/api/meals/2026-11-18/dinner', payload: { allocations: [{ foodItemId: eggs.id, quantity: 4 }] } })
    ).json();

    const eaten = await request({ method: 'POST', url: `/api/meals/${meal.id}/consume` });
    expect(eaten.json()).toMatchObject({ consumed: true });
    expect(await item(eggs.id)).toMatchObject({ quantity: 2, planned: 0, available: 2 });

    const edit = await request({ method: 'PUT', url: '/api/meals/2026-11-18/dinner', payload: { allocations: [] } });
    expect(edit.statusCode).toBe(409);
    expect(edit.json().message).toBe('Ya está marcada como consumida; deshazlo antes de editarla');

    await request({ method: 'POST', url: `/api/meals/${meal.id}/unconsume` });
    expect(await item(eggs.id)).toMatchObject({ quantity: 6, planned: 4, available: 2 });
  });

  it('never takes more than what is in stock when eating', async () => {
    const { request, create, item } = await setup();
    const eggs = await create('Huevos', 2);
    const meal = (
      await request({ method: 'PUT', url: '/api/meals/2026-11-18/dinner', payload: { allocations: [{ foodItemId: eggs.id, quantity: 5 }] } })
    ).json();
    await request({ method: 'POST', url: `/api/meals/${meal.id}/consume` });
    expect(await item(eggs.id)).toMatchObject({ quantity: 0, status: 'out' });
    await request({ method: 'POST', url: `/api/meals/${meal.id}/unconsume` });
    expect(await item(eggs.id)).toMatchObject({ quantity: 2 });
  });

  it('rejects unknown food items and invalid dates', async () => {
    const { request } = await setup();
    const unknown = await request({ method: 'PUT', url: '/api/meals/2026-11-18/dinner', payload: { allocations: [{ foodItemId: 'nope', quantity: 1 }] } });
    expect(unknown.statusCode).toBe(404);
    const badDate = await request({ method: 'PUT', url: '/api/meals/2026-13-40/dinner', payload: {} });
    expect(badDate.statusCode).toBe(400);
    expect(badDate.json().message).toBe('Fecha: no tiene un formato válido');
    const badType = await request({ method: 'PUT', url: '/api/meals/2026-11-18/brunch', payload: {} });
    expect(badType.statusCode).toBe(400);
  });
});
