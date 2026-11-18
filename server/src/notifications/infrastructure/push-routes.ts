import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../../auth/auth-routes.js';
import type { PushNotifier } from '../application/push-notifier.js';
import { isPushServiceEndpoint } from '../domain/push-endpoint.js';

const endpoint = z.string().max(2048).refine(isPushServiceEndpoint, 'El servicio de notificaciones no es válido');

const subscription = z.object({
  endpoint,
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export function registerPushRoutes(app: FastifyInstance, notifier: PushNotifier) {
  app.get('/api/push', async (request) => {
    requireUser(request);
    return { publicKey: notifier.publicKey };
  });

  app.post('/api/push/subscriptions', async (request, reply) => {
    const user = requireUser(request);
    const { endpoint, keys } = subscription.parse(request.body);
    notifier.subscribe({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, user.id, user.householdId);
    return reply.code(201).send();
  });

  app.delete('/api/push/subscriptions', async (request, reply) => {
    const user = requireUser(request);
    notifier.unsubscribe(z.object({ endpoint: z.string().max(2048) }).parse(request.body).endpoint, user.id);
    return reply.code(204).send();
  });
}
