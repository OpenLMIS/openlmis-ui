import { describe, expect, it } from 'vitest';
import { pageOfCategories } from '@/features/rejection-reasons/lib/categories-list';

const categories = Array.from({ length: 14 }, (_, index) => ({
  id: `id-${index}`,
  name: `Category ${String(index).padStart(2, '0')}`,
  code: `C-${index}`,
  active: index % 2 === 0,
})).reverse();

describe('category local pages', () => {
  it('orders the complete collection before slicing and uses code then id to break ties', () => {
    const records = [
      ...categories,
      { id: 'tie-b', name: 'Category 00', code: 'A', active: false },
      { id: 'tie-a', name: 'Category 00', code: 'A', active: false },
    ];
    expect(pageOfCategories(records, { size: 2 }).content.map(({ id }) => id)).toEqual([
      'tie-a',
      'tie-b',
    ]);
    expect(pageOfCategories(records, { page: 2, size: 2 }).content.map(({ id }) => id)).toEqual([
      'id-0',
      'id-1',
    ]);
    expect(pageOfCategories(records, { size: 2, dir: 'desc' }).content.map(({ id }) => id)).toEqual(
      ['id-13', 'id-12'],
    );
  });

  it('filters before counting and clamping a page beyond the filtered end', () => {
    const result = pageOfCategories(categories, { name: ' CATEGORY 0 ', size: 4, page: 12 });
    expect(result.totalElements).toBe(10);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(3);
    expect(result.content.map(({ id }) => id)).toEqual(['id-8', 'id-9']);
    expect(pageOfCategories(categories, { name: 'missing', page: 7 }).page).toBe(1);
    expect(pageOfCategories(categories, { name: 'missing' }).content).toEqual([]);
  });
});
