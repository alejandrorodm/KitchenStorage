import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../../auth/auth-routes.js';
import type { PushNotifier } from '../application/push-notifier.js';

// The server sends requests to these endpoints, so only real browser push services are accepted.
const PUSH_SERVICE_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];

const endpoint = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.port && PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname));
    } catch {
      return false;
    }
  }, 'El servicio de notificaciones no es válido');

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
