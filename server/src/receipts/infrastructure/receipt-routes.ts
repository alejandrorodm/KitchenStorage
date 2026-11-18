import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { foodItemInput } from '../../inventory/infrastructure/inventory-routes.js';
import type { ReceiptService } from '../application/receipt-service.js';

export function registerReceiptRoutes(app: FastifyInstance, receiptsFor: (request: FastifyRequest) => ReceiptService) {
  app.get('/api/receipts/status', async (request) => ({ enabled: receiptsFor(request).enabled }));

  app.post('/api/receipts/read', async (request) => {
    const file = await request.file();
    if (!file) throw new AppError(400, 'validation_error', 'Adjunta la foto del ticket en el campo "image"');
    const image = await file.toBuffer();
    return { lines: await receiptsFor(request).read(image, file.mimetype) };
  });

  app.post('/api/receipts/confirm', async (request, reply) => {
    const { lines } = z
      .object({ lines: z.array(foodItemInput.omit({ lowThreshold: true }).extend({ quantity: z.number().finite().positive().max(1_000_000) })).min(1).max(200) })
      .parse(request.body);
    return reply.code(201).send(receiptsFor(request).confirm(lines));
  });
}
