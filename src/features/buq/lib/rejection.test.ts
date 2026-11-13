import { expect, it } from 'vitest';
import { buqRejectionReasons, rejectionSchema } from '@/features/buq/lib/rejection';
import type { RejectionReason } from '@/features/reference-data/lib/types';

const reason = (
  id: string,
  overrides: Partial<RejectionReason> = {},
  category: Partial<RejectionReason['rejectionReasonCategory']> = {},
): RejectionReason => ({
  id,
  code: id,
  name: `Reason ${id}`,
  active: true,
  rejectionReasonCategory: { id: 'c1', code: 'BUQ', name: 'BUQ', active: true, ...category },
  ...overrides,
});

it('offers only active reasons of the active BUQ category', () => {
  const reasons = [
    reason('kept'),
    reason('other-category', {}, { name: 'Requisition' }),
    reason('inactive', { active: false }),
    reason('inactive-category', {}, { active: false }),
  ];

  expect(buqRejectionReasons(reasons)).toEqual([{ value: 'kept', label: 'Reason kept' }]);
});

it('needs a reason and at most 4000 characters of comments', () => {
  expect(rejectionSchema.safeParse({ rejectionReasons: [], generalComments: '' }).success).toBe(
    false,
  );
  expect(
    rejectionSchema.safeParse({ rejectionReasons: ['r1'], generalComments: 'x'.repeat(4001) })
      .success,
  ).toBe(false);
  expect(
    rejectionSchema.safeParse({ rejectionReasons: ['r1'], generalComments: 'x'.repeat(4000) })
      .success,
  ).toBe(true);
});
