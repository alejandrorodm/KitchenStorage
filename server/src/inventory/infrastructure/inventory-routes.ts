import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { InventoryService } from '../application/inventory-service.js';
import { LOCATIONS, UNITS } from '../domain/stock.js';

export const foodItemInput = z.object({
  name: z.string().trim().min(1).max(120),
  location: z.enum(LOCATIONS),
  quantity: z.number().finite().min(0).max(1_000_000),
  unit: z.enum(UNITS),
  lowThreshold: z.number().finite().min(0).max(1_000_000).optional(),
});

const idParam = z.object({ id: z.string().min(1) });

export function registerInventoryRoutes(app: FastifyInstance, inventory: InventoryService) {
  app.get('/api/items', async () => inventory.list());

  app.get('/api/alerts', async () => inventory.list().filter((item) => item.status !== 'ok'));

  app.post('/api/items', async (request, reply) => {
    const item = inventory.create(foodItemInput.parse(request.body));
    return reply.code(201).send(item);
  });

  app.patch('/api/items/:id', async (request) => {
    const { id } = idParam.parse(request.params);
    return inventory.update(id, foodItemInput.partial().parse(request.body));
  });

  app.post('/api/items/:id/adjust', async (request) => {
    const { id } = idParam.parse(request.params);
    const { delta } = z.object({ delta: z.number().finite() }).parse(request.body);
    return inventory.adjust(id, delta);
  });

  app.delete('/api/items/:id', async (request, reply) => {
    inventory.delete(idParam.parse(request.params).id);
    return reply.code(204).send();
  });
}
