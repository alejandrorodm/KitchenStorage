import type { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp } from '../src/app.js';
import type { ReceiptParser } from '../src/receipts/application/receipt-service.js';

export const INVITE_CODE = 'test-invite';

export const fakeReceiptParser: ReceiptParser = {
  async parse() {
    return [
      { name: 'Leche entera', quantity: 6, unit: 'l', location: 'pantry' },
      { name: 'Pechuga de pollo', quantity: 0.5, unit: 'kg', location: 'fridge' },
    ];
  },
};

export async function createTestApp(receiptParser: ReceiptParser | null = fakeReceiptParser) {
  const app = await buildApp({ databasePath: ':memory:', inviteCode: INVITE_CODE, receiptParser, cookieSecure: false });
  return app;
}

/** Registers a user and returns a request helper that sends its session cookie. */
export async function signedIn(app: FastifyInstance, username = 'ana') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, password: 'correct horse battery', inviteCode: INVITE_CODE },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const cookie = sessionCookie(res.headers['set-cookie']);
  return (options: InjectOptions) =>
    app.inject({ ...options, headers: { ...options.headers, cookie } });
}

export function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error('no session cookie');
  return value.split(';')[0]!;
}
