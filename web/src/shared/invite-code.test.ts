import { describe, expect, it } from 'vitest';
import { formatInviteCode } from './invite-code';

describe('formatInviteCode', () => {
  it('splits an 8-character code in two halves', () => {
    expect(formatInviteCode('K7M2Q9XP')).toBe('K7M2-Q9XP');
  });

  it('leaves other codes as they are', () => {
    expect(formatInviteCode('ABC')).toBe('ABC');
  });
});
