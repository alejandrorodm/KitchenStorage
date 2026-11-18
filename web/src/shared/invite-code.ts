/** Shows an 8-character code as two easy-to-read halves: ABCD-EFGH. */
export function formatInviteCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
