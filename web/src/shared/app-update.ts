export type UpdateResult = 'updating' | 'up-to-date';

/**
 * Asks the server for a newer version of the app. When there is one, the new
 * service worker takes over and the page reloads with it (registerSW in
 * main.tsx does it in autoUpdate mode; the listener below is a fallback).
 */
export async function checkForUpdate(): Promise<UpdateResult> {
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (!registration) {
    // No service worker (e.g. first visit or unsupported): a plain reload already gets the latest files.
    location.reload();
    return 'updating';
  }
  await registration.update();
  const incoming = registration.installing ?? registration.waiting;
  if (!incoming) return 'up-to-date';
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  return 'updating';
}

/** "18 nov 2026, 14:32": when the running version was built. */
export function buildLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'desconocida';
  return date.toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
