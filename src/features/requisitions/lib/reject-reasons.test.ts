import { expect, it } from 'vitest';
import { availableRejectReasons } from '@/features/requisitions/lib/reject-reasons';

it('offers active unused reasons of active categories sorted by name', () => {
  const category = { id: 'c', name: 'Category', code: 'C', active: true };
  const reason = {
    id: 'r',
    name: 'Reason',
    code: 'R',
    active: true,
    rejectionReasonCategory: category,
  };
  expect(
    availableRejectReasons(
      [
        reason,
        { ...reason, id: 'inactive', active: false },
        { ...reason, id: 'other', rejectionReasonCategory: { ...category, id: 'off' } },
      ],
      [category],
      [],
    ),
  ).toEqual([reason]);
  expect(availableRejectReasons([reason], [category], [reason])).toEqual([]);
});

it('drops exhausted categories until their selected reason is removed', async () => {
  const { availableRejectCategories } = await import('./reject-reasons');
  const category = { id: 'c', name: 'Category', code: 'C', active: true };
  const reason = {
    id: 'r',
    name: 'Reason',
    code: 'R',
    active: true,
    rejectionReasonCategory: category,
  };
  expect(availableRejectCategories([category], [])).toEqual([]);
  expect(availableRejectCategories([category], [reason])).toEqual([category]);
});
