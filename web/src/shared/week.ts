/** Local-date helpers for the Monday-to-Sunday planner, using YYYY-MM-DD strings. */

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Monday of the week that contains `date`. */
export function startOfWeek(date: Date): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return toIsoDate(copy);
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatDay(iso: string): string {
  return fromIsoDate(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "martes, 17 de noviembre" */
export function formatLongDay(iso: string): string {
  return fromIsoDate(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "lun" and "17", for the compact day picker. */
export function dayParts(iso: string): { weekday: string; day: number } {
  const date = fromIsoDate(iso);
  return { weekday: date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''), day: date.getDate() };
}
