import { randomBytes } from 'node:crypto';

// 32 symbols without look-alikes (no I, O, 0, 1): each random byte maps to one without bias.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

/** A random 8-character code (40 bits), stored and compared in this canonical form. */
export function generateInviteCode(): string {
  return [...randomBytes(LENGTH)].map((byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

/** Accepts codes as people type them: any case, with spaces or dashes. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
