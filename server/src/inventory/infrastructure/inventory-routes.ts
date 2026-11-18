import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { InventoryService } from '../application/inventory-service.js';
import { LOCATIONS, UNITS } from '../domain/stock.js';

export const foodItemInput = z.object({
  name: z.string().trim().min(1).max(120),
  location: z.enum(LOCATIONS),
  quantity: z.number().finite().min(0).max(1_000_000),
  unit: z.enum(UNITS),
  lowThreshold: z.number().finite().min(0).max(1_000_000).nullable().optional(),
  categoryId: z.string().min(1).max(64).nullable().optional(),
});

const idParam = z.object({ id: z.string().min(1) });

/** Routes get the service of the signed-in user's household for each request. */
export function registerInventoryRoutes(app: FastifyInstance, inventoryFor: (request: FastifyRequest) => InventoryService) {
  app.get('/api/items', async (request) => inventoryFor(request).list());

  app.get('/api/alerts', async (request) => inventoryFor(request).list().filter((item) => item.status !== 'ok'));

  app.post('/api/items', async (request, reply) => {
    const item = inventoryFor(request).create(foodItemInput.parse(request.body));
    return reply.code(201).send(item);
  });

  app.patch('/api/items/:id', async (request) => {
    const { id } = idParam.parse(request.params);
    return inventoryFor(request).update(id, foodItemInput.partial().parse(request.body));
  });

  app.post('/api/items/:id/adjust', async (request) => {
    const { id } = idParam.parse(request.params);
    const { delta } = z.object({ delta: z.number().finite() }).parse(request.body);
    return inventoryFor(request).adjust(id, delta);
  });

  app.delete('/api/items/:id', async (request, reply) => {
    inventoryFor(request).delete(idParam.parse(request.params).id);
    return reply.code(204).send();
  });
}
