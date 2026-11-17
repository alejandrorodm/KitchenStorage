import { describe, expect, it } from 'vitest';
import { countOf } from './labels';

describe('countOf', () => {
  it('uses the singular only for exactly one', () => {
    expect(countOf(1, 'producto', 'productos')).toBe('1 producto');
    expect(countOf(0, 'producto', 'productos')).toBe('0 productos');
    expect(countOf(3, 'producto', 'productos')).toBe('3 productos');
  });
});
