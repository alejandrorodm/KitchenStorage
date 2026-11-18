import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signedIn } from './helpers.js';
import { GeminiReceiptParser, parseGeminiResponse } from '../src/receipts/infrastructure/gemini-receipt-parser.js';
import { AppError } from '../src/shared/errors.js';

let app: FastifyInstance;
afterEach(() => app?.close());

function multipart(mimeType: string) {
  const boundary = '----ks-test';
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="ticket.jpg"\r\nContent-Type: ${mimeType}\r\n\r\n`),
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('receipts', () => {
  it('reads a receipt photo into reviewable lines without storing anything', async () => {
    app = await createTestApp();
    const request = await signedIn(app);
    const res = await request({ method: 'POST', url: '/api/receipts/read', ...multipart('image/jpeg') });
    expect(res.statusCode).toBe(200);
    expect(res.json().lines).toHaveLength(3);
    expect((await request({ method: 'GET', url: '/api/items' })).json()).toEqual([]);
  });

  it('rejects files that are not images', async () => {
    app = await createTestApp();
    const request = await signedIn(app);
    const res = await request({ method: 'POST', url: '/api/receipts/read', ...multipart('application/pdf') });
    expect(res.statusCode).toBe(415);
  });

  it('reports 503 when no Gemini key is configured', async () => {
    app = await createTestApp(null);
    const request = await signedIn(app);
    expect((await request({ method: 'GET', url: '/api/receipts/status' })).json()).toEqual({ enabled: false });
    expect((await request({ method: 'POST', url: '/api/receipts/read', ...multipart('image/jpeg') })).statusCode).toBe(503);
  });

  it('reports 502 with the original error kept as the cause when the parser fails', async () => {
    const failure = new Error('JSON mode is not enabled for api version v1');
    app = await createTestApp({ parse: () => Promise.reject(failure) });
    const request = await signedIn(app);
    const res = await request({ method: 'POST', url: '/api/receipts/read', ...multipart('image/jpeg') });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      error: 'receipt_read_failed',
      message: 'No se pudo leer el ticket. Inténtalo de nuevo o añade los productos a mano',
    });
  });

  it('merges confirmed lines into matching items and creates the rest', async () => {
    app = await createTestApp();
    const request = await signedIn(app);
    await request({ method: 'POST', url: '/api/items', payload: { name: 'Leche Entera', location: 'pantry', quantity: 1, unit: 'l' } });

    const res = await request({
      method: 'POST',
      url: '/api/receipts/confirm',
      payload: {
        lines: [
          { name: 'leche entera', quantity: 6, unit: 'l', location: 'pantry' },
          { name: 'Pechuga de pollo', quantity: 0.5, unit: 'kg', location: 'fridge' },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().map((r: { merged: boolean }) => r.merged)).toEqual([true, false]);

    const items = (await request({ method: 'GET', url: '/api/items' })).json();
    expect(items).toHaveLength(2);
    expect(items.find((i: { name: string }) => i.name === 'Leche Entera')).toMatchObject({ quantity: 7 });
  });
});

describe('parseGeminiResponse', () => {
  it('keeps valid lines, defaults unknown units/locations and drops malformed lines', () => {
    const lines = parseGeminiResponse(
      JSON.stringify({
        items: [
          { name: 'Yogur', quantity: 4, unit: 'unit', location: 'fridge', category: 'Lácteos' },
          { name: 'Queso', quantity: 1, unit: 'pack', location: 'cellar', category: '' },
          { name: '', quantity: 1, unit: 'unit', location: 'fridge' },
          { name: 'Agua', quantity: -1, unit: 'l', location: 'pantry' },
        ],
      }),
    );
    expect(lines).toEqual([
      { name: 'Yogur', quantity: 4, unit: 'unit', location: 'fridge', category: 'Lácteos' },
      { name: 'Queso', quantity: 1, unit: 'unit', location: 'pantry', category: null },
    ]);
  });
});

describe('GeminiReceiptParser', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Structured JSON output only exists in v1beta; the SDK defaults to v1, which rejects it.
  it('calls the v1beta generateContent endpoint and parses its JSON answer', async () => {
    const urls: string[] = [];
    const bodies: string[] = [];
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      urls.push(input instanceof Request ? input.url : String(input));
      bodies.push(String(init?.body ?? ''));
      const text = JSON.stringify({ items: [{ name: 'Leche', quantity: 6, unit: 'l', location: 'pantry', category: 'Lácteos' }] });
      return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] }), {
        headers: { 'content-type': 'application/json' },
      });
    });

    const lines = await new GeminiReceiptParser('test-key', 'gemini-2.5-flash').parse(Buffer.from([0xff, 0xd8]), 'image/jpeg', ['Lácteos', 'Frutas']);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/v1beta/models/gemini-2.5-flash:generateContent');
    expect(bodies[0]).toContain('Categories: [\\"Lácteos\\",\\"Frutas\\"]');
    expect(lines).toEqual([{ name: 'Leche', quantity: 6, unit: 'l', location: 'pantry', category: 'Lácteos' }]);
  });

  it('retries an overloaded Gemini and falls back to the second model', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      urls.push(input instanceof Request ? input.url : String(input));
      if (urls.length <= 3) {
        return new Response(JSON.stringify({ error: { code: 503, message: 'high demand', status: 'UNAVAILABLE' } }), { status: 503, headers: { 'content-type': 'application/json' } });
      }
      const text = JSON.stringify({ items: [{ name: 'Leche', quantity: 1, unit: 'l', location: 'fridge' }] });
      return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] }), { headers: { 'content-type': 'application/json' } });
    });

    const parser = new GeminiReceiptParser('test-key', 'gemini-2.5-flash', { fallbackModel: 'gemini-2.5-flash-lite', sleep: async () => {} });
    const lines = await parser.parse(Buffer.from([0xff, 0xd8]), 'image/jpeg', []);

    expect(lines).toEqual([{ name: 'Leche', quantity: 1, unit: 'l', location: 'fridge', category: null }]);
    expect(urls.slice(0, 3).every((url) => url.includes('/models/gemini-2.5-flash:'))).toBe(true);
    expect(urls[3]).toContain('/models/gemini-2.5-flash-lite:');
  });
});

describe('AppError', () => {
  it('keeps the underlying error as its cause', () => {
    const cause = new Error('boom');
    expect(new AppError(502, 'receipt_read_failed', 'x', { cause }).cause).toBe(cause);
  });
});
