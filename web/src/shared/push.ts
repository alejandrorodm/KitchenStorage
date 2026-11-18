import { api } from '../api/client';

/** Push needs a service worker, the Push API and notifications (iOS: only once installed on the home screen). */
export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** The app's service worker, or null when none is registered (never waits like `serviceWorker.ready`). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  return (await (await registration())?.pushManager.getSubscription()) ?? null;
}

/** Asks for permission (if needed), subscribes this device and registers it with the server. */
export async function enablePush(publicKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Has bloqueado las notificaciones. Actívalas en los ajustes del navegador o de la app.');
  const worker = await registration();
  if (!worker) throw new Error('La app aún no está lista para notificaciones. Recarga la página e inténtalo de nuevo.');
  const key = base64UrlToBytes(publicKey);
  let subscription = await worker.pushManager.getSubscription();
  // A subscription made with an older server key no longer receives anything: replace it.
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api<void>('POST', '/api/push/subscriptions', subscription.toJSON());
}

/** Stops notifications on this device; used when turning them off and when signing out. */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api<void>('DELETE', '/api/push/subscriptions', { endpoint: subscription.endpoint }).catch(() => undefined);
  await subscription.unsubscribe();
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sameKey(current: ArrayBuffer | null, expected: Uint8Array): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((byte, i) => byte === expected[i]);
}
