import { describe, expect, it } from 'vitest';
import { normalizeName, stockStatus } from '../src/inventory/domain/stock.js';

describe('stockStatus', () => {
  it('is "out" when nothing is available', () => {
    expect(stockStatus(0, 1)).toBe('out');
    expect(stockStatus(-2, 1)).toBe('out');
  });

  it('is "low" when available is above zero but at or under the threshold', () => {
    expect(stockStatus(1, 1)).toBe('low');
    expect(stockStatus(0.5, 2)).toBe('low');
  });

  it('is "ok" when available is above the threshold', () => {
    expect(stockStatus(3, 1)).toBe('ok');
    expect(stockStatus(1, 0)).toBe('ok');
  });
});

describe('normalizeName', () => {
  it('ignores case, accents and surrounding or repeated whitespace', () => {
    expect(normalizeName('  Plátano   de  Canarias ')).toBe('platano de canarias');
    expect(normalizeName('LECHE')).toBe(normalizeName('leche'));
  });
});
