import { describe, expect, it } from 'vitest';
import { normalizeForMatch, splitLines, suggestionToDish } from './dishes';

describe('normalizeForMatch', () => {
  it('treats names that differ only in case, accents or spacing as the same', () => {
    expect(normalizeForMatch('  Cebolla   MORADA ')).toBe(normalizeForMatch('cebolla morada'));
    expect(normalizeForMatch('Limón')).toBe('limon');
  });
});

describe('suggestionToDish', () => {
  it('keeps everything the AI gave, with what it uses and what is missing as ingredients', () => {
    const dish = suggestionToDish({
      title: 'Tortilla',
      description: 'Clásica',
      minutes: 30,
      uses: ['Huevos', 'Patatas'],
      missing: ['Cebolla'],
      steps: ['Freír', 'Cuajar'],
      sourceUrl: 'https://www.themealdb.com/meal/52872',
    });
    expect(dish).toEqual({
      title: 'Tortilla',
      description: 'Clásica',
      minutes: 30,
      ingredients: ['Huevos', 'Patatas', 'Cebolla'],
      steps: ['Freír', 'Cuajar'],
      sourceUrl: 'https://www.themealdb.com/meal/52872',
    });
  });
});

describe('splitLines', () => {
  it('turns a text box into one entry per non-empty line', () => {
    expect(splitLines(' Huevos \n\n  Patatas\r\nSal  \n ')).toEqual(['Huevos', 'Patatas', 'Sal']);
    expect(splitLines('')).toEqual([]);
  });
});
