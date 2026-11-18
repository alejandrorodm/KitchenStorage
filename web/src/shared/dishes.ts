import type { DishInput, DishSuggestion } from '../api/types';

/** Key to tell whether two ingredient names are the same, ignoring case, accents and spacing. */
export function normalizeForMatch(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim()
    .replace(/\s+/g, ' ');
}

/** What gets saved in My dishes from an AI idea: every ingredient, the ones at home and the ones to buy. */
export function suggestionToDish(suggestion: DishSuggestion): DishInput {
  return {
    title: suggestion.title,
    description: suggestion.description,
    minutes: suggestion.minutes,
    ingredients: [...suggestion.uses, ...suggestion.missing],
    steps: suggestion.steps,
    sourceUrl: suggestion.sourceUrl,
  };
}

/** One entry per non-empty line of a text box. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
