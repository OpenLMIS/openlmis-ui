import { expect, it } from 'vitest';
import {
  approvalSearchSchema,
  approvalSelectionError,
  toApprovalQuery,
} from '@/features/requisitions/lib/approval-search';

it('keeps emergency first with the two supported authorization orders and server paging', () => {
  expect(toApprovalQuery(approvalSearchSchema.parse({}))).toEqual({
    page: 0,
    size: 20,
    sort: ['emergency,desc', 'authorizedDate,desc'],
  });
  expect(
    toApprovalQuery(
      approvalSearchSchema.parse({
        dir: 'asc',
        page: 3,
        size: 10,
        program: '11111111-1111-4111-8111-111111111111',
      }),
    ),
  ).toEqual({
    page: 2,
    size: 10,
    sort: ['emergency,desc', 'authorizedDate,asc'],
    program: '11111111-1111-4111-8111-111111111111',
  });
});
it('checks every selected program across pages and refuses an empty selection', () => {
  expect(approvalSelectionError([])).toBe('none');
  expect(approvalSelectionError([{ programId: 'a' }, { programId: 'a' }])).toBeUndefined();
  expect(approvalSelectionError([{ programId: 'a' }, { programId: 'b' }])).toBe('mixed');
});
