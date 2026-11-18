import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PushSender, PushTarget } from '../src/notifications/application/push-notifier.js';
import { stockAlertMessages } from '../src/notifications/domain/stock-alert-messages.js';
import { createTestApp, signedIn } from './helpers.js';

let app: FastifyInstance;
afterEach(() => app?.close());

interface Sent {
  endpoint: string;
  title: string;
  body: string;
  tag: string;
  url: string;
}

/** Records every push instead of sending it; endpoints in `gone` answer like an expired subscription. */
function fakeSender(gone = new Set<string>()) {
  const sent: Sent[] = [];
  const sender: PushSender = {
    publicKey: 'BTestPublicKey',
    async send(target: PushTarget, payload: string) {
      sent.push({ endpoint: target.endpoint, ...JSON.parse(payload) });
      return gone.has(target.endpoint) ? 'gone' : 'sent';
    },
  };
  return { sender, sent };
}

const endpoint = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;
const subscription = (name: string) => ({ endpoint: endpoint(name), keys: { p256dh: `p256-${name}`, auth: `auth-${name}` } });
const item = (name: string, quantity = 1) => ({ name, location: 'pantry', quantity, unit: 'unit' });

async function setup() {
  const push = fakeSender();
  app = await createTestApp(undefined, { pushSender: push.sender });
  const ana = await signedIn(app, 'ana');
  const code = (await ana({ method: 'GET', url: '/api/household' })).json().inviteCode;
  const bob = await signedIn(app, 'bob', code);
  const eve = await signedIn(app, 'eve');
  for (const [user, name] of [[ana, 'ana-phone'], [bob, 'bob-phone'], [eve, 'eve-phone']] as const) {
    expect((await user({ method: 'POST', url: '/api/push/subscriptions', payload: subscription(name) })).statusCode).toBe(201);
  }
  return { push, ana, bob, eve };
}

describe('push notifications', () => {
  it('tells the browser the public key, or null when push is not configured', async () => {
    app = await createTestApp(undefined, { pushSender: fakeSender().sender });
    const ana = await signedIn(app, 'ana');
    expect((await ana({ method: 'GET', url: '/api/push' })).json()).toEqual({ publicKey: 'BTestPublicKey' });
    expect((await app.inject({ method: 'GET', url: '/api/push' })).statusCode).toBe(401);
    await app.close();

    app = await createTestApp();
    const bob = await signedIn(app, 'bob');
    expect((await bob({ method: 'GET', url: '/api/push' })).json()).toEqual({ publicKey: null });
    expect((await bob({ method: 'POST', url: '/api/push/subscriptions', payload: subscription('x') })).statusCode).toBe(503);
  });

  it('only accepts subscriptions from known push services', async () => {
    app = await createTestApp(undefined, { pushSender: fakeSender().sender });
    const ana = await signedIn(app, 'ana');
    for (const payload of [
      { ...subscription('x'), endpoint: 'https://evil.example.com/push' },
      { ...subscription('x'), endpoint: 'http://fcm.googleapis.com/fcm/send/x' },
      { ...subscription('x'), endpoint: 'https://fcm.googleapis.com.evil.com/x' },
      // Parser-mismatch bypasses: web-push's legacy url.parse would send these to another host.
      { ...subscription('x'), endpoint: 'https://localhost%2enotify.windows.com/x' },
      { ...subscription('x'), endpoint: 'https://kitchen%2enotify.windows.com/admin' },
      { ...subscription('x'), endpoint: 'https:fcm.googleapis.com/x' },
      { ...subscription('x'), endpoint: 'https://fcm%2egoogleapis.com/y' },
      { ...subscription('x'), endpoint: 'https://evil@fcm.googleapis.com/x' },
      { ...subscription('x'), endpoint: 'https://FCM.googleapis.com/x' },
      { ...subscription('x'), endpoint: ' https://fcm.googleapis.com/x' },
      { endpoint: endpoint('x') },
    ]) {
      expect((await ana({ method: 'POST', url: '/api/push/subscriptions', payload })).statusCode).toBe(400);
    }
    for (const host of ['updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2-db5p.notify.windows.com']) {
      const payload = { ...subscription('x'), endpoint: `https://${host}/abc` };
      expect((await ana({ method: 'POST', url: '/api/push/subscriptions', payload })).statusCode).toBe(201);
    }
  });

  it('notifies every device in the household, and nobody else, when an item runs out', async () => {
    const { push, ana } = await setup();
    const milk = (await ana({ method: 'POST', url: '/api/items', payload: item('Leche') })).json();
    expect(push.sent).toEqual([]);

    await ana({ method: 'POST', url: `/api/items/${milk.id}/adjust`, payload: { delta: -1 } });

    await vi.waitFor(() => expect(push.sent).toHaveLength(2));
    expect(push.sent.map((s) => s.endpoint).sort()).toEqual([endpoint('ana-phone'), endpoint('bob-phone')]);
    expect(push.sent[0]).toMatchObject({ title: 'Se ha acabado: Leche', body: 'Ya está en la lista de la compra.', url: '/#shopping', tag: `stock-${milk.id}` });
  });

  it('sends one notification per item for up to 3 items, and one summary for more', async () => {
    const { push, ana, eve } = await setup();
    for (const name of ['Arroz', 'Pasta', 'Huevos']) await ana({ method: 'POST', url: '/api/items', payload: item(name, 2) });
    await ana({ method: 'PATCH', url: '/api/household', payload: { lowThreshold: 2 } });
    await vi.waitFor(() => expect(push.sent).toHaveLength(6));
    expect(push.sent.filter((s) => s.endpoint === endpoint('ana-phone')).map((s) => s.title).sort()).toEqual([
      'Se está acabando: Arroz',
      'Se está acabando: Huevos',
      'Se está acabando: Pasta',
    ]);

    for (const name of ['A', 'B', 'C', 'D']) await eve({ method: 'POST', url: '/api/items', payload: item(name, 2) });
    push.sent.length = 0;
    await eve({ method: 'PATCH', url: '/api/household', payload: { lowThreshold: 2 } });
    await vi.waitFor(() => expect(push.sent).toHaveLength(1));
    expect(push.sent[0]).toMatchObject({ endpoint: endpoint('eve-phone'), title: '4 alimentos se están acabando', body: 'A, B, C y D', tag: 'stock-summary' });
  });

  it('does not repeat the alert while the item stays in the list, or when bought entries are cleared', async () => {
    const { push, ana } = await setup();
    const milk = (await ana({ method: 'POST', url: '/api/items', payload: item('Leche', 2) })).json();
    await ana({ method: 'PATCH', url: '/api/household', payload: { lowThreshold: 1 } });
    await ana({ method: 'POST', url: `/api/items/${milk.id}/adjust`, payload: { delta: -1 } });
    await vi.waitFor(() => expect(push.sent).toHaveLength(2));

    await ana({ method: 'POST', url: `/api/items/${milk.id}/adjust`, payload: { delta: -1 } });
    const [entry] = (await ana({ method: 'GET', url: '/api/shopping' })).json();
    await ana({ method: 'PATCH', url: `/api/shopping/${entry.id}`, payload: { checked: true } });
    await ana({ method: 'POST', url: '/api/shopping/clear-checked' });
    expect((await ana({ method: 'GET', url: '/api/shopping' })).json()).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(push.sent).toHaveLength(2);
  });

  it('forgets devices that unsubscribe or whose subscription expired', async () => {
    const push = fakeSender(new Set([endpoint('old-phone')]));
    app = await createTestApp(undefined, { pushSender: push.sender });
    const ana = await signedIn(app, 'ana');
    for (const name of ['old-phone', 'new-phone', 'tablet']) {
      await ana({ method: 'POST', url: '/api/push/subscriptions', payload: subscription(name) });
    }
    const res = await ana({ method: 'DELETE', url: '/api/push/subscriptions', payload: { endpoint: endpoint('tablet') } });
    expect(res.statusCode).toBe(204);

    const a = (await ana({ method: 'POST', url: '/api/items', payload: item('A') })).json();
    await ana({ method: 'POST', url: `/api/items/${a.id}/adjust`, payload: { delta: -1 } });
    await vi.waitFor(() => expect(push.sent).toHaveLength(2));

    const b = (await ana({ method: 'POST', url: '/api/items', payload: item('B') })).json();
    await ana({ method: 'POST', url: `/api/items/${b.id}/adjust`, payload: { delta: -1 } });
    await vi.waitFor(() => expect(push.sent).toHaveLength(3));
    expect(push.sent[2]!.endpoint).toBe(endpoint('new-phone'));
  });

  it('keeps working when a push fails', async () => {
    app = await createTestApp(undefined, {
      pushSender: { publicKey: 'k', send: () => Promise.reject(new Error('network down')) },
    });
    const ana = await signedIn(app, 'ana');
    await ana({ method: 'POST', url: '/api/push/subscriptions', payload: subscription('x') });
    const milk = (await ana({ method: 'POST', url: '/api/items', payload: item('Leche') })).json();
    const res = await ana({ method: 'POST', url: `/api/items/${milk.id}/adjust`, payload: { delta: -1 } });
    expect(res.statusCode).toBe(200);
  });
});

describe('stockAlertMessages', () => {
  const alert = (name: string, status: 'low' | 'out') => ({ id: name, name, status });

  it('names each item when there are up to 3', () => {
    expect(stockAlertMessages([alert('Leche', 'out'), alert('Pan', 'low')]).map((m) => m.title)).toEqual(['Se ha acabado: Leche', 'Se está acabando: Pan']);
  });

  it('summarises more than 3, saying whether they ran out', () => {
    const out = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => alert(n, 'out'));
    expect(stockAlertMessages(out)).toEqual([{ title: '7 alimentos se han acabado', body: 'A, B, C, D, E y 2 más', tag: 'stock-summary', url: '/#shopping' }]);
    expect(stockAlertMessages([...out.slice(0, 3), alert('H', 'low')])[0]!.title).toBe('4 alimentos se han acabado o se están acabando');
  });
});

describe('push limits and delivery', () => {
  it('keeps only the 10 most recent devices per user', async () => {
    const push = fakeSender();
    app = await createTestApp(undefined, { pushSender: push.sender });
    const ana = await signedIn(app, 'ana');
    for (let n = 1; n <= 12; n++) await ana({ method: 'POST', url: '/api/push/subscriptions', payload: subscription(`d${n}`) });
    const milk = (await ana({ method: 'POST', url: '/api/items', payload: item('Leche') })).json();
    await ana({ method: 'POST', url: `/api/items/${milk.id}/adjust`, payload: { delta: -1 } });
    await vi.waitFor(() => expect(push.sent).toHaveLength(10));
    expect(push.sent.map((s) => s.endpoint)).not.toContain(endpoint('d1'));
    expect(push.sent.map((s) => s.endpoint)).not.toContain(endpoint('d2'));
  });
});

describe('WebPushSender', () => {
  it('sends with a timeout and treats expired or foreign-key subscriptions as gone', async () => {
    const { default: webpush } = await import('web-push');
    const { WebPushSender } = await import('../src/notifications/infrastructure/web-push-sender.js');
    const send = vi.spyOn(webpush, 'sendNotification');
    const keys = webpush.generateVAPIDKeys();
    expect(() => new WebPushSender(keys.publicKey, keys.privateKey, 'not-a-url')).toThrow();
    const sender = new WebPushSender(keys.publicKey, keys.privateKey, 'https://example.test');
    const target = { endpoint: endpoint('x'), p256dh: 'p', auth: 'a' };
    try {
      send.mockResolvedValueOnce({ statusCode: 201, body: '', headers: {} });
      expect(await sender.send(target, 'hi')).toBe('sent');
      expect(send.mock.calls[0]![2]).toMatchObject({ TTL: 43200, timeout: 10000, vapidDetails: { publicKey: keys.publicKey, privateKey: keys.privateKey } });
      for (const statusCode of [401, 403, 404, 410]) {
        send.mockRejectedValueOnce(Object.assign(new Error('rejected'), { statusCode }));
        expect(await sender.send(target, 'hi')).toBe('gone');
      }
      send.mockRejectedValueOnce(Object.assign(new Error('busy'), { statusCode: 429 }));
      await expect(sender.send(target, 'hi')).rejects.toThrow('busy');
    } finally {
      send.mockRestore();
    }
  });
});
