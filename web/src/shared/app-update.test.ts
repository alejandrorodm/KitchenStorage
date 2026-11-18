import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyWhenIdle, buildLabel } from './app-update';

describe('buildLabel', () => {
  it('shows when the version was built, or says it is unknown', () => {
    expect(buildLabel('2026-11-18T14:32:00')).toMatch(/18 nov.* 2026.*14:32/);
    expect(buildLabel('dev')).toBe('desconocida');
  });
});

describe('applyWhenIdle', () => {
  afterEach(() => vi.useRealTimers());

  it('applies the update at once when nothing is going on', () => {
    const apply = vi.fn();
    applyWhenIdle(apply, () => false);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('waits until the app is idle, so a running action and its message are not cut off', () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    let busy = true;
    applyWhenIdle(apply, () => busy, 1000);
    vi.advanceTimersByTime(5000);
    expect(apply).not.toHaveBeenCalled();
    busy = false;
    vi.advanceTimersByTime(1000);
    expect(apply).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
