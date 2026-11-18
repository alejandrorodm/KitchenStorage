import { describe, expect, it } from 'vitest';
import { normalizeForMatch } from './dishes';

describe('normalizeForMatch', () => {
  it('treats names that differ only in case, accents or spacing as the same', () => {
    expect(normalizeForMatch('  Cebolla   MORADA ')).toBe(normalizeForMatch('cebolla morada'));
    expect(normalizeForMatch('Limón')).toBe('limon');
  });
});
