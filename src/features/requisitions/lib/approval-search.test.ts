import { expect, it } from 'vitest';
import { approvalProgramsMixed } from '@/features/requisitions/lib/approval-search';

it('checks every selected program across pages', () => {
  expect(approvalProgramsMixed([{ programId: 'a' }, { programId: 'a' }])).toBe(false);
  expect(approvalProgramsMixed([{ programId: 'a' }, { programId: 'b' }])).toBe(true);
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

it('orders page two then page one selections using the requested page size', async () => {
  const { approvalRowIndex, approvalSelectedIds } = await import(
    '@/features/requisitions/lib/approval-search'
  );
  expect(
    approvalSelectedIds(
      new Map([
        [
          'page-two',
          { programId: 'p', label: 'Two', rowIndex: approvalRowIndex({ page: 2, size: 50 }, 0) },
        ],
        [
          'page-one',
          { programId: 'p', label: 'One', rowIndex: approvalRowIndex({ page: 1, size: 50 }, 49) },
        ],
      ]),
    ),
  ).toEqual(['page-one', 'page-two']);
  expect(approvalRowIndex({ page: 2, size: 50 }, 0)).toBe(50);
});
