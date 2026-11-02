import { expect, it } from 'vitest';
import { approvalSelectionError } from '@/features/requisitions/lib/approval-search';

it('checks every selected program across pages and refuses an empty selection', () => {
  expect(approvalSelectionError([])).toBe('none');
  expect(approvalSelectionError([{ programId: 'a' }, { programId: 'a' }])).toBeUndefined();
  expect(approvalSelectionError([{ programId: 'a' }, { programId: 'b' }])).toBe('mixed');
});

it('hands off selected ids in global list order rather than tick order', async () => {
  const { approvalSelectedIds } = await import('@/features/requisitions/lib/approval-search');
  expect(
    approvalSelectedIds(
      new Map([
        ['last', { programId: 'p', label: 'Last', rowIndex: 42 }],
        ['first', { programId: 'p', label: 'First', rowIndex: 0 }],
        ['middle', { programId: 'p', label: 'Middle', rowIndex: 21 }],
      ]),
    ),
  ).toEqual(['first', 'middle', 'last']);
});
