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

  it('rejects percent-encoded API paths without a session', async () => {
    app = await createTestApp();
    for (const url of ['/%61pi/items', '/%61pi/shopping', '/%61pi/alerts', '/%61pi/events', '/api/%69tems']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(401);
    }
    const write = await app.inject({ method: 'POST', url: '/%61pi/items', payload: { name: 'x', location: 'fridge', quantity: 1, unit: 'unit' } });
    expect(write.statusCode).toBe(401);
  });

  it('explains in Spanish why a username is invalid', async () => {
    app = await createTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'ana garcía', password: 'correct horse battery', inviteCode: INVITE_CODE },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'validation_error', message: 'Usuario: solo letras, números, punto, guion o guion bajo, sin espacios' });

    const short = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'ana', password: 'corto', inviteCode: INVITE_CODE },
    });
    expect(short.json().message).toBe('Contraseña: debe tener al menos 8 caracteres');
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
