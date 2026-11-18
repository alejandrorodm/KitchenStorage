import type { StockStatus } from '../../inventory/domain/stock.js';

export interface StockAlert {
  id: string;
  name: string;
  status: Exclude<StockStatus, 'ok'>;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Notifications with the same tag replace each other on the device. */
  tag: string;
  /** Page opened when the notification is tapped. */
  url: string;
}

/** Up to this many items get one notification each; more are summarised in one. */
export const MAX_SEPARATE_ALERTS = 3;
const NAMES_IN_SUMMARY = 5;
const SHOPPING_URL = '/#shopping';

export function stockAlertMessages(alerts: StockAlert[]): PushMessage[] {
  if (alerts.length === 0) return [];
  if (alerts.length <= MAX_SEPARATE_ALERTS) {
    return alerts.map((alert) => ({
      title: `${alert.status === 'out' ? 'Se ha acabado' : 'Se está acabando'}: ${alert.name}`,
      body: 'Ya está en la lista de la compra.',
      tag: `stock-${alert.id}`,
      url: SHOPPING_URL,
    }));
  }
  const out = alerts.filter((alert) => alert.status === 'out').length;
  const verb = out === alerts.length ? 'se han acabado' : out === 0 ? 'se están acabando' : 'se han acabado o se están acabando';
  return [{ title: `${alerts.length} alimentos ${verb}`, body: listNames(alerts.map((a) => a.name)), tag: 'stock-summary', url: SHOPPING_URL }];
}

/** "A, B y C"; past five names, "A, B, C, D, E y 2 más". */
function listNames(names: string[]): string {
  if (names.length > NAMES_IN_SUMMARY) return `${names.slice(0, NAMES_IN_SUMMARY).join(', ')} y ${names.length - NAMES_IN_SUMMARY} más`;
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}
