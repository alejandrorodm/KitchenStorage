import { describe, expect, it } from 'vitest';
import { createTestApp, newHouseholdCode, register, sessionCookie } from './helpers.js';

describe('shutdown', () => {
  // A deploy restarts the server; open live-update streams must not hold it down (requests get 502 meanwhile).
  it('closes at once even while a device keeps the live-update stream open', async () => {
    const app = await createTestApp();
    const cookie = sessionCookie((await register(app, 'ana', newHouseholdCode(app))).headers['set-cookie']);
    const address = await app.listen({ host: '127.0.0.1', port: 0 });

    const stream = await fetch(`${address}/api/events`, { headers: { cookie } });
    expect(stream.status).toBe(200);

    const started = Date.now();
    await app.close();
    expect(Date.now() - started).toBeLessThan(1000);
  }, 10_000);
});
