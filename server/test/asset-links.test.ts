import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers.js';

let app: FastifyInstance;
afterEach(() => app?.close());

describe('/.well-known/assetlinks.json', () => {
  it('lets the signed Android app open the site full screen, without a session', async () => {
    app = await createTestApp();
    const res = await app.inject({ method: 'GET', url: '/.well-known/assetlinks.json' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json()).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.alejandrorodm.kitchenstorage',
          sha256_cert_fingerprints: [
            'ED:E9:D2:A7:F9:9C:BA:B1:B8:9A:18:EC:D5:9D:6B:09:0A:B8:E1:FD:A4:2E:8D:FD:0B:9B:D4:78:7B:6E:2E:B6',
          ],
        },
      },
    ]);
  });
});
