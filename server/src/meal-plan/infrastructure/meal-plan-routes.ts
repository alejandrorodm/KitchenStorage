import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MEAL_TYPES, type MealPlanService } from '../application/meal-plan-service.js';

const isoDate = z.iso.date();

const mealInput = z.object({
  title: z.string().max(200).default(''),
  allocations: z
    .array(z.object({ foodItemId: z.string().min(1), quantity: z.number().finite().positive().max(1_000_000) }))
    .max(50)
    .default([]),
});

export function registerMealPlanRoutes(app: FastifyInstance, meals: MealPlanService) {
  app.get('/api/meals', async (request) => {
    const { from, to } = z.object({ from: isoDate, to: isoDate }).parse(request.query);
    return meals.week(from, to);
  });

  app.put('/api/meals/:date/:mealType', async (request) => {
    const { date, mealType } = z.object({ date: isoDate, mealType: z.enum(MEAL_TYPES) }).parse(request.params);
    return meals.save(date, mealType, mealInput.parse(request.body ?? {}));
  });

  app.post('/api/meals/:id/consume', async (request) => meals.consume(mealId(request.params)));

  app.post('/api/meals/:id/unconsume', async (request) => meals.unconsume(mealId(request.params)));

  app.delete('/api/meals/:id', async (request, reply) => {
    meals.delete(mealId(request.params));
    return reply.code(204).send();
  });
}

function mealId(params: unknown): string {
  return z.object({ id: z.string().min(1) }).parse(params).id;
}
