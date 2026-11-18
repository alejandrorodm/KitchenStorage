import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/auth-routes.js';
import type { User } from '../auth/auth-service.js';
import { AppError } from '../shared/errors.js';
import type { HouseholdService } from './household-service.js';

export function registerHouseholdRoutes(app: FastifyInstance, households: HouseholdService) {
  // The signed-in user's own household.
  app.get('/api/household', async (request) => households.view(requireUser(request).householdId));

  app.post('/api/household/invite-code', async (request) => households.regenerateCode(requireUser(request).householdId));

  // Admin only: codes that create new households, and an overview of households.
  app.get('/api/admin/invites', async (request) => {
    requireAdmin(request);
    return households.listInvites();
  });

  app.post('/api/admin/invites', async (request, reply) => {
    const admin = requireAdmin(request);
    return reply.code(201).send(households.createInvite(admin.id));
  });

  app.delete('/api/admin/invites/:code', async (request, reply) => {
    requireAdmin(request);
    households.revokeInvite(z.object({ code: z.string().min(1).max(40) }).parse(request.params).code);
    return reply.code(204).send();
  });

  app.get('/api/admin/households', async (request) => {
    requireAdmin(request);
    return households.listHouseholds();
  });
}

function requireAdmin(request: FastifyRequest): User {
  const user = requireUser(request);
  if (!user.isAdmin) throw new AppError(403, 'forbidden', 'Solo un administrador puede hacer esto');
  return user;
}
