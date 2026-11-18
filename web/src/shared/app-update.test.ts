import { describe, expect, it } from 'vitest';
import { buildLabel } from './app-update';

describe('buildLabel', () => {
  it('shows when the version was built, or says it is unknown', () => {
    expect(buildLabel('2026-11-18T14:32:00')).toMatch(/18 nov.* 2026.*14:32/);
    expect(buildLabel('dev')).toBe('desconocida');
  });
});
