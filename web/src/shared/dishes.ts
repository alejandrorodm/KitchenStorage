/** Key to tell whether two ingredient names are the same, ignoring case, accents and spacing. */
export function normalizeForMatch(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim()
    .replace(/\s+/g, ' ');
}
