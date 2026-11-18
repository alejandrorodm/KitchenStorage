import { describe, expect, it } from 'vitest';
import { alertLabel, countOf } from './labels';

describe('countOf', () => {
  it('uses the singular only for exactly one', () => {
    expect(countOf(1, 'producto', 'productos')).toBe('1 producto');
    expect(countOf(0, 'producto', 'productos')).toBe('0 productos');
    expect(countOf(3, 'producto', 'productos')).toBe('3 productos');
  });
});

describe('alertLabel', () => {
  it('says when the alert fires, with 0 meaning when it runs out', () => {
    expect(alertLabel(0)).toBe('al acabarse');
    expect(alertLabel(2)).toBe('cuando queden 2');
    expect(alertLabel(0.5, 'kg')).toBe('cuando queden 0,5 kg');
  });
});
