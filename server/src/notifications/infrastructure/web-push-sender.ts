import webpush from 'web-push';
import type { PushSender, PushTarget } from '../application/push-notifier.js';

const TTL_SECONDS = 12 * 60 * 60;
const TIMEOUT_MS = 10_000;
/**
 * 404/410: the subscription expired or was revoked. 401/403: it was made with
 * other VAPID keys (e.g. after rotating them), so it can never work again.
 */
const GONE_STATUSES = new Set([401, 403, 404, 410]);

/** Sends Web Push messages signed with this server's VAPID keys. */
export class WebPushSender implements PushSender {
  constructor(
    readonly publicKey: string,
    private readonly privateKey: string,
    private readonly subject: string,
  ) {
    // Throws at startup on malformed keys or a subject that is not a mailto: or https: URL.
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  async send(target: PushTarget, payload: string): Promise<'sent' | 'gone'> {
    try {
      await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, payload, {
        TTL: TTL_SECONDS,
        timeout: TIMEOUT_MS,
        vapidDetails: { subject: this.subject, publicKey: this.publicKey, privateKey: this.privateKey },
      });
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status !== undefined && GONE_STATUSES.has(status)) return 'gone';
      throw error;
    }
  }
}
