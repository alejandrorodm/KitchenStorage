import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DishService } from '../application/dish-service.js';

const line = (max: number) => z.string().trim().min(1).max(max);

const dishFields = {
  title: line(120),
  description: z.string().trim().max(400),
  minutes: z.number().int().min(1).max(1440).nullable(),
  ingredients: z.array(line(120)).max(50),
  steps: z.array(line(600)).max(30),
  sourceUrl: z.string().url().max(500).refine((url) => /^https?:\/\//.test(url), 'Enlace no válido').nullable(),
};

const createInput = z.object({
  title: dishFields.title,
  description: dishFields.description.default(''),
  minutes: dishFields.minutes.default(null),
  ingredients: dishFields.ingredients.default([]),
  steps: dishFields.steps.default([]),
  sourceUrl: dishFields.sourceUrl.default(null),
});
const updateInput = z.object(dishFields).partial();
const idParam = z.object({ id: z.string().min(1) });

export function registerDishRoutes(app: FastifyInstance, dishesFor: (request: FastifyRequest) => DishService) {
  app.get('/api/dishes', async (request) => dishesFor(request).list());

  app.post('/api/dishes', async (request, reply) => reply.code(201).send(dishesFor(request).create(createInput.parse(request.body))));

  app.patch('/api/dishes/:id', async (request) => {
    const { id } = idParam.parse(request.params);
    return dishesFor(request).update(id, updateInput.parse(request.body));
  });

  app.delete('/api/dishes/:id', async (request, reply) => {
    dishesFor(request).delete(idParam.parse(request.params).id);
    return reply.code(204).send();
  });
}
