import type { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp, type AppOptions } from '../src/app.js';
import type { ReceiptParser } from '../src/receipts/application/receipt-service.js';

export const PASSWORD = 'correct horse battery';

export const fakeReceiptParser: ReceiptParser = {
  async parse() {
    return [
      { name: 'Leche entera', quantity: 6, unit: 'l', location: 'pantry' },
      { name: 'Pechuga de pollo', quantity: 0.5, unit: 'kg', location: 'fridge' },
    ];
  },
};

export async function createTestApp(receiptParser: ReceiptParser | null = fakeReceiptParser, options: Partial<AppOptions> = {}) {
  return buildApp({ databasePath: ':memory:', receiptParser, cookieSecure: false, ...options });
}

/** A single-use code that creates a new household, as an admin would generate it. */
export function newHouseholdCode(app: FastifyInstance): string {
  return app.households.createInvite(null).code;
}

export function register(app: FastifyInstance, username: string, inviteCode: string) {
  return app.inject({ method: 'POST', url: '/api/auth/register', payload: { username, password: PASSWORD, inviteCode } });
}

/**
 * Registers a user and returns a request helper that sends its session cookie.
 * Without `inviteCode` the user gets a household of their own.
 */
export async function signedIn(app: FastifyInstance, username = 'ana', inviteCode = newHouseholdCode(app)) {
  const res = await register(app, username, inviteCode);
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  return withCookie(app, sessionCookie(res.headers['set-cookie']));
}

export async function signedInAdmin(app: FastifyInstance, username = 'admin') {
  await app.auth.createAdmin(username, PASSWORD);
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: PASSWORD } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  return withCookie(app, sessionCookie(res.headers['set-cookie']));
}

function withCookie(app: FastifyInstance, cookie: string) {
  return (options: InjectOptions) => app.inject({ ...options, headers: { ...options.headers, cookie } });
}

export function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error('no session cookie');
  return value.split(';')[0]!;
}
