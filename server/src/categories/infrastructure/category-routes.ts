import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { CategoryService } from '../application/category-service.js';

const categoryInput = z.object({ name: z.string().trim().min(1).max(60) });
const idParam = z.object({ id: z.string().min(1) });

export function registerCategoryRoutes(app: FastifyInstance, categoriesFor: (request: FastifyRequest) => CategoryService) {
  app.get('/api/categories', async (request) => categoriesFor(request).list());

  app.post('/api/categories', async (request, reply) => {
    const { name } = categoryInput.parse(request.body);
    return reply.code(201).send(categoriesFor(request).create(name));
  });

  app.patch('/api/categories/:id', async (request) => {
    const { id } = idParam.parse(request.params);
    return categoriesFor(request).rename(id, categoryInput.parse(request.body).name);
  });

  app.delete('/api/categories/:id', async (request, reply) => {
    categoriesFor(request).delete(idParam.parse(request.params).id);
    return reply.code(204).send();
  });
}
