import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AssistantService } from '../application/assistant-service.js';

const suggestInput = z.object({ wish: z.string().max(200).optional() });

export function registerAssistantRoutes(app: FastifyInstance, assistantFor: (request: FastifyRequest) => AssistantService) {
  app.get('/api/ai/status', async (request) => ({ enabled: assistantFor(request).enabled }));

  app.post('/api/items/categorize', async (request) => assistantFor(request).categorizeUncategorized());

  app.post('/api/dishes/suggest', async (request) => {
    const { wish } = suggestInput.parse(request.body ?? {});
    return { dishes: await assistantFor(request).suggestDishes(wish ?? '') };
  });
}
