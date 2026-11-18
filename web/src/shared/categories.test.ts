import { describe, expect, it } from 'vitest';
import { groupByCategory, UNCATEGORIZED } from './categories';

const item = (name: string, categoryId: string | null) => ({ name, categoryId });

describe('groupByCategory', () => {
  it('groups items under their categories in category order and puts uncategorized items last', () => {
    const categories = [
      { id: 'c1', name: 'Frutas' },
      { id: 'c2', name: 'Proteínas' },
      { id: 'c3', name: 'Bebidas' },
    ];
    const groups = groupByCategory([item('Manzana', 'c1'), item('Sal', null), item('Pollo', 'c2'), item('Pera', 'c1'), item('Raro', 'gone')], categories);
    expect(groups.map((g) => [g.id, g.name, g.items.map((i) => i.name)])).toEqual([
      ['c1', 'Frutas', ['Manzana', 'Pera']],
      ['c2', 'Proteínas', ['Pollo']],
      ['c3', 'Bebidas', []],
      [UNCATEGORIZED, 'Sin sección', ['Sal', 'Raro']],
    ]);
  });

  it('leaves out the uncategorized group when every item has a category', () => {
    const groups = groupByCategory([item('Manzana', 'c1')], [{ id: 'c1', name: 'Frutas' }]);
    expect(groups.map((g) => g.id)).toEqual(['c1']);
  });
});
