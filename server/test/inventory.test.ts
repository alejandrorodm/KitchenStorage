import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signedIn } from './helpers.js';

let app: FastifyInstance;
afterEach(() => app?.close());

describe('inventory', () => {
  it('creates, lists, edits, adjusts and deletes items', async () => {
    app = await createTestApp();
    const request = await signedIn(app);

    const created = await request({
      method: 'POST',
      url: '/api/items',
      payload: { name: ' Huevos ', location: 'fridge', quantity: 12, unit: 'unit', lowThreshold: 4 },
    });
    expect(created.statusCode).toBe(201);
    const egg = created.json();
    expect(egg).toMatchObject({ name: 'Huevos', quantity: 12, available: 12, planned: 0, status: 'ok' });

    const edited = await request({ method: 'PATCH', url: `/api/items/${egg.id}`, payload: { location: 'pantry' } });
    expect(edited.json()).toMatchObject({ location: 'pantry', quantity: 12 });

    const adjusted = await request({ method: 'POST', url: `/api/items/${egg.id}/adjust`, payload: { delta: -9 } });
    expect(adjusted.json()).toMatchObject({ quantity: 3, status: 'low' });

    const emptied = await request({ method: 'POST', url: `/api/items/${egg.id}/adjust`, payload: { delta: -50 } });
    expect(emptied.json()).toMatchObject({ quantity: 0, status: 'out' });

    const list = await request({ method: 'GET', url: '/api/items' });
    expect(list.json()).toHaveLength(1);

    expect((await request({ method: 'DELETE', url: `/api/items/${egg.id}` })).statusCode).toBe(204);
    expect((await request({ method: 'DELETE', url: `/api/items/${egg.id}` })).statusCode).toBe(404);
  });

  it('rejects invalid input with 400', async () => {
    app = await createTestApp();
    const request = await signedIn(app);
    const res = await request({ method: 'POST', url: '/api/items', payload: { name: '', location: 'garage', quantity: -1, unit: 'unit' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'validation_error' });
  });

  it('publishes a change event when stock changes', async () => {
    app = await createTestApp();
    const request = await signedIn(app);
    const received: string[][] = [];
    app.changeEvents.subscribe((topics) => received.push(topics));
    await request({ method: 'POST', url: '/api/items', payload: { name: 'Arroz', location: 'pantry', quantity: 1, unit: 'kg' } });
    expect(received.flat()).toContain('inventory');
  });
});
