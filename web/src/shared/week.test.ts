import { describe, expect, it } from 'vitest';
import { addDays, startOfWeek, weekDays } from './week';

describe('week helpers', () => {
  it('starts the week on Monday, including when the date is a Sunday', () => {
    expect(startOfWeek(new Date(2026, 10, 17))).toBe('2026-11-16'); // Tuesday
    expect(startOfWeek(new Date(2026, 10, 22))).toBe('2026-11-16'); // Sunday
    expect(startOfWeek(new Date(2026, 10, 16))).toBe('2026-11-16'); // Monday
  });

  it('lists seven consecutive days across month boundaries', () => {
    expect(weekDays('2026-11-30')).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
      '2026-12-06',
    ]);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
