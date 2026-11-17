import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../shared/errors.js';
import { AttemptLimiter, type AuthService, type Session, type User } from './auth-service.js';

export const SESSION_COOKIE = 'ks_session';

const credentials = z.object({
  username: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N}._-]+$/u, 'Letters, numbers, dot, dash or underscore'),
  password: z.string().min(8).max(200),
});

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

export function registerAuth(app: FastifyInstance, auth: AuthService, options: { cookieSecure: boolean }) {
  const limiter = new AttemptLimiter();

  // Every other API route requires a valid session.
  app.addHook('onRequest', async (request) => {
    request.user = auth.userForToken(request.cookies[SESSION_COOKIE]);
    const url = request.url.split('?')[0]!;
    const isPublic = !url.startsWith('/api/') || url === '/api/health' || /^\/api\/auth\/(login|register|logout)$/.test(url);
    if (!isPublic) requireUser(request);
  });

  const setSession = (reply: FastifyReply, session: Session) =>
    reply.setCookie(SESSION_COOKIE, session.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: options.cookieSecure,
      expires: session.expiresAt,
    });

  app.post('/api/auth/register', async (request, reply) => {
    limiter.hit(request.ip);
    const body = credentials.extend({ inviteCode: z.string() }).parse(request.body);
    const { user, session } = await auth.register(body.username, body.password, body.inviteCode);
    setSession(reply, session);
    return reply.code(201).send(user);
  });

  app.post('/api/auth/login', async (request, reply) => {
    limiter.hit(request.ip);
    const body = z.object({ username: z.string().trim(), password: z.string() }).parse(request.body);
    const { user, session } = await auth.login(body.username, body.password);
    setSession(reply, session);
    return user;
  });

  app.post('/api/auth/logout', async (request, reply) => {
    auth.logout(request.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/api/auth/me', async (request) => requireUser(request));
}

function requireUser(request: FastifyRequest): User {
  if (!request.user) throw new AppError(401, 'unauthenticated', 'Sign in required');
  return request.user;
}
