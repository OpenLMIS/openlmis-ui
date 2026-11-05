import { z } from 'zod';
import type { ApprovalListRow } from '@/features/requisitions/lib/types';
import { tableSearchSchema, toPaginationState, toSortParam } from '@/lib/table-search';

export const APPROVAL_SORT = { id: 'authorizedDate', desc: true };
export const approvalSearchSchema = tableSearchSchema(['authorizedDate']).extend({
  offline: z.boolean().optional().catch(undefined),
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
export type ApprovalSelection = ReadonlyMap<
  string,
  { programId: string; label: string; rowIndex: number; record?: ApprovalListRow }
>;
export const approvalProgramsMixed = (selected: readonly { programId: string }[]) =>
  new Set(selected.map(({ programId }) => programId)).size > 1;
export const approvalScope = (search: ApprovalSearch, online = true) =>
  JSON.stringify([search.program, search.offline || !online || undefined, search.sort, search.dir]);

export const approvalSelectedIds = (picked: ApprovalSelection) =>
  [...picked].sort((a, b) => a[1].rowIndex - b[1].rowIndex).map(([id]) => id);

export function approvalRowIndex(search: ApprovalSearch, index: number) {
  const { page, size } = toApprovalQuery(search);
  return page * size + index;
}
