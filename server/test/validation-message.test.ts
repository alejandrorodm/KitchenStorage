import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validationMessage } from '../src/shared/validation-message.js';

function messageFor(schema: z.ZodType, value: unknown): string {
  const result = schema.safeParse(value);
  if (result.success) throw new Error('expected a validation error');
  return validationMessage(result.error);
}

describe('validationMessage', () => {
  it('uses the singular when an array admits at most one element', () => {
    expect(messageFor(z.object({ lines: z.array(z.number()).max(1) }), { lines: [1, 2] })).toBe(
      'Productos: admite como máximo 1 elemento',
    );
  });

  it('does not resolve inherited object keys as field labels', () => {
    expect(messageFor(z.object({ toString: z.string() }), { toString: 1 })).toBe('toString: falta o no es válido');
  });
});
