import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UNITS } from '../../inventory/domain/stock.js';
import type { ShoppingService } from '../application/shopping-service.js';

const idParam = z.object({ id: z.string().min(1) });

export function registerShoppingRoutes(app: FastifyInstance, shopping: ShoppingService) {
  app.get('/api/shopping', async () => shopping.list());

  app.post('/api/shopping', async (request, reply) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(120),
        quantity: z.number().finite().positive().max(1_000_000).nullish(),
        unit: z.enum(UNITS).nullish(),
      })
      .parse(request.body);
    return reply.code(201).send(shopping.add(body));
  });

  app.patch('/api/shopping/:id', async (request) => {
    const { id } = idParam.parse(request.params);
    const { checked } = z.object({ checked: z.boolean() }).parse(request.body);
    return shopping.setChecked(id, checked);
  });

  app.delete('/api/shopping/:id', async (request, reply) => {
    shopping.delete(idParam.parse(request.params).id);
    return reply.code(204).send();
  });

  app.post('/api/shopping/clear-checked', async () => ({ removed: shopping.clearChecked() }));
}
