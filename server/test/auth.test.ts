import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, INVITE_CODE, sessionCookie, signedIn } from './helpers.js';

let app: FastifyInstance;
afterEach(() => app?.close());

describe('auth', () => {
  it('rejects API calls without a session', async () => {
    app = await createTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/items' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects registration with a wrong invite code', async () => {
    app = await createTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'ana', password: 'correct horse battery', inviteCode: 'nope' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('registers, reports the current user, logs out and logs back in', async () => {
    app = await createTestApp();
    const request = await signedIn(app, 'ana');

    const me = await request({ method: 'GET', url: '/api/auth/me' });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ username: 'ana' });

    const logout = await request({ method: 'POST', url: '/api/auth/logout' });
    expect(logout.statusCode).toBe(204);
    expect((await request({ method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'ANA', password: 'correct horse battery' },
    });
    expect(login.statusCode).toBe(200);
    const cookie = sessionCookie(login.headers['set-cookie']);
    expect((await app.inject({ method: 'GET', url: '/api/items', headers: { cookie } })).statusCode).toBe(200);
  });

  it('rejects a wrong password and a duplicate username', async () => {
    app = await createTestApp();
    await signedIn(app, 'ana');
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'ana', password: 'wrong password!' } });
    expect(login.statusCode).toBe(401);
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Ana', password: 'another long one', inviteCode: INVITE_CODE },
    });
    expect(duplicate.statusCode).toBe(409);
  });
});
