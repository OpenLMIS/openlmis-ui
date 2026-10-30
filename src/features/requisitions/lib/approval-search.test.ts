import { expect, it } from 'vitest';
import { approvalSelectionError } from '@/features/requisitions/lib/approval-search';

it('checks every selected program across pages and refuses an empty selection', () => {
  expect(approvalSelectionError([])).toBe('none');
  expect(approvalSelectionError([{ programId: 'a' }, { programId: 'a' }])).toBeUndefined();
  expect(approvalSelectionError([{ programId: 'a' }, { programId: 'b' }])).toBe('mixed');
});
