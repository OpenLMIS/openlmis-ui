import { expect, it } from 'vitest';
import { pageOfRejectionReasons } from '@/features/rejection-reasons/lib/rejection-reasons-list';

it('sorts embedded category labels and filters names before local paging and page clamping', () => {
  const reasons = Array.from({ length: 14 }, (_, index) => ({
    id: `id-${index}`,
    code: `C${String(index).padStart(2, '0')}`,
    name: `Reason ${index}`,
    active: true,
    rejectionReasonCategory: {
      id: `cat-${index}`,
      code: `CAT${index}`,
      name: index < 7 ? 'Zulu' : 'Alpha',
      active: false,
    },
  })).reverse();
  const result = pageOfRejectionReasons(reasons, { sort: 'category', size: 3, page: 2 });
  expect(result.content.map(({ id }) => id)).toEqual(['id-10', 'id-11', 'id-12']);
  expect(
    pageOfRejectionReasons(reasons, { sort: 'category', dir: 'desc', size: 3 }).content.map(
      ({ id }) => id,
    ),
  ).toEqual(['id-0', 'id-1', 'id-2']);
  const filtered = pageOfRejectionReasons(reasons, {
    name: ' REASON 1 ',
    size: 2,
    page: 99,
    sort: 'code',
  });
  expect(filtered.totalElements).toBe(5);
  expect(filtered.page).toBe(3);
  expect(filtered.content.map(({ id }) => id)).toEqual(['id-13']);
});
