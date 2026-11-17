import type { ZodError } from 'zod';

type Issue = ZodError['issues'][number];

/** Spanish names for request fields, as the user sees them in the forms. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  location: 'Ubicación',
  quantity: 'Cantidad',
  unit: 'Unidad',
  lowThreshold: 'Aviso de stock bajo',
  delta: 'Cantidad',
  username: 'Usuario',
  password: 'Contraseña',
  inviteCode: 'Código de invitación',
  title: 'Plato',
  allocations: 'Ingredientes',
  foodItemId: 'Alimento',
  date: 'Fecha',
  mealType: 'Tipo de comida',
  from: 'Fecha de inicio',
  to: 'Fecha de fin',
  checked: 'Marcado',
  lines: 'Productos',
};

/**
 * Turns the first validation issue into a short Spanish sentence such as
 * "Cantidad: debe ser mayor o igual que 0", naming the field and the reason.
 */
export function validationMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Datos no válidos';
  const field = [...issue.path].reverse().find((segment) => typeof segment === 'string');
  const label = field ? (Object.hasOwn(FIELD_LABELS, field) ? FIELD_LABELS[field] : field) : 'Datos';
  return `${label}: ${reason(issue)}`;
}

function reason(issue: Issue): string {
  switch (issue.code) {
    case 'invalid_type':
      return 'falta o no es válido';
    case 'invalid_value':
      return 'no es una opción válida';
    case 'invalid_format':
      // Regex rules carry their own Spanish explanation (see auth-routes.ts).
      return issue.format === 'regex' ? lowerFirst(issue.message) : 'no tiene un formato válido';
    case 'too_small':
      return tooSmall(issue.origin, Number(issue.minimum), issue.inclusive ?? true);
    case 'too_big':
      return tooBig(issue.origin, Number(issue.maximum), issue.inclusive ?? true);
    default:
      return 'no es válido';
  }
}

function tooSmall(origin: string, minimum: number, inclusive: boolean): string {
  if (origin === 'string') return minimum <= 1 ? 'no puede estar vacío' : `debe tener al menos ${minimum} caracteres`;
  if (origin === 'array') return `necesita al menos ${minimum} elemento${minimum === 1 ? '' : 's'}`;
  return inclusive ? `debe ser mayor o igual que ${minimum}` : `debe ser mayor que ${minimum}`;
}

function tooBig(origin: string, maximum: number, inclusive: boolean): string {
  if (origin === 'string') return `no puede tener más de ${maximum} caracteres`;
  if (origin === 'array') return `admite como máximo ${maximum} elemento${maximum === 1 ? '' : 's'}`;
  return inclusive ? `debe ser menor o igual que ${maximum}` : `debe ser menor que ${maximum}`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('es') + text.slice(1);
}
