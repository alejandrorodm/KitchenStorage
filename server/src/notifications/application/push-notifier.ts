import { AppError } from '../../shared/errors.js';
import { stockAlertMessages, type StockAlert } from '../domain/stock-alert-messages.js';

/** Where and how to reach one browser, as given by its PushManager subscription. */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Port: delivers an encrypted push (Web Push in production). */
export interface PushSender {
  /** VAPID public key the browser subscribes with. */
  readonly publicKey: string;
  /** 'gone' means the subscription expired or was revoked and should be forgotten. */
  send(target: PushTarget, payload: string): Promise<'sent' | 'gone'>;
}

export interface PushSubscriptionRepository {
  save(target: PushTarget, userId: string, householdId: string): void;
  delete(endpoint: string, userId: string): void;
  forget(endpoint: string): void;
  forHousehold(householdId: string): PushTarget[];
}

interface Log {
  error(details: object, message: string): void;
}

export class PushNotifier {
  constructor(
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly sender: PushSender | null,
    private readonly log: Log,
  ) {}

  get publicKey(): string | null {
    return this.sender?.publicKey ?? null;
  }

  subscribe(target: PushTarget, userId: string, householdId: string): void {
    if (!this.sender) throw new AppError(503, 'push_disabled', 'Las notificaciones no están configuradas en el servidor');
    this.subscriptions.save(target, userId, householdId);
  }

  unsubscribe(endpoint: string, userId: string): void {
    this.subscriptions.delete(endpoint, userId);
  }

  /**
   * Tells every device of the household about items that just started needing
   * a restock. Never throws: a failed push must not fail the stock change.
   */
  async notifyStockAlerts(householdId: string, alerts: StockAlert[]): Promise<void> {
    const sender = this.sender;
    if (!sender || alerts.length === 0) return;
    const targets = this.subscriptions.forHousehold(householdId);
    const payloads = stockAlertMessages(alerts).map((message) => JSON.stringify(message));
    await Promise.all(
      targets.flatMap((target) =>
        payloads.map(async (payload) => {
          try {
            if ((await sender.send(target, payload)) === 'gone') this.subscriptions.forget(target.endpoint);
          } catch (error) {
            this.log.error({ err: error, host: new URL(target.endpoint).host }, 'push notification failed');
          }
        }),
      ),
    );
  }
}
