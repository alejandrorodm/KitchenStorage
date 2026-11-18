import webpush from 'web-push';
import type { PushSender, PushTarget } from '../application/push-notifier.js';

const TTL_SECONDS = 12 * 60 * 60;

/** Sends Web Push messages signed with this server's VAPID keys. */
export class WebPushSender implements PushSender {
  constructor(
    readonly publicKey: string,
    private readonly privateKey: string,
    private readonly subject: string,
  ) {}

  async send(target: PushTarget, payload: string): Promise<'sent' | 'gone'> {
    try {
      await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, payload, {
        TTL: TTL_SECONDS,
        vapidDetails: { subject: this.subject, publicKey: this.publicKey, privateKey: this.privateKey },
      });
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone';
      throw error;
    }
  }
}
