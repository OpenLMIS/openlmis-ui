import { z } from 'zod';
import { tableSearchSchema, toPaginationState, toSortParam } from '@/lib/table-search';

export const APPROVAL_SORT = { id: 'authorizedDate', desc: true };
export const approvalSearchSchema = tableSearchSchema(['authorizedDate']).extend({
  program: z.uuid().optional().catch(undefined),
});
export type ApprovalSearch = z.infer<typeof approvalSearchSchema>;
export function toApprovalQuery(search: ApprovalSearch) {
  const { pageIndex, pageSize } = toPaginationState(search, 20);
  return {
    page: pageIndex,
    size: pageSize,
    sort: ['emergency,desc', toSortParam(search, APPROVAL_SORT)],
    ...(search.program && { program: search.program }),
  };
}
export type ApprovalSelection = ReadonlyMap<string, { programId: string; label: string }>;
export function approvalSelectionError(selected: readonly { programId: string }[]) {
  if (!selected.length) return 'none';
  if (new Set(selected.map(({ programId }) => programId)).size !== 1) return 'mixed';
}
export const approvalScope = (search: ApprovalSearch) =>
  JSON.stringify([search.program, search.sort, search.dir]);
