import type { z } from 'zod';
import type { RequisitionGroupsSearch } from '@/features/requisition-groups/lib/types';
import { tableSearchSchema, textFilterSchema, toPaginationState } from '@/lib/table-search';

export const REQUISITION_GROUP_HIDEABLE_COLUMNS = [
  { id: 'program', labelKey: 'requisition-groups.program', hideBelow: 'lg' },
  { id: 'code', labelKey: 'requisition-groups.code', hideBelow: 'lg' },
  { id: 'supervisoryNode', labelKey: 'requisition-groups.supervisory-node', hideBelow: '4xl' },
  { id: 'zone', labelKey: 'requisition-groups.zone', hideBelow: '5xl' },
  { id: 'facilityCount', labelKey: 'requisition-groups.facility-count', hideBelow: '2xl' },
] as const;

export const requisitionGroupsSearchSchema = tableSearchSchema(['name'])
  .omit({ sort: true, dir: true })
  .extend({ name: textFilterSchema, zone: textFilterSchema, program: textFilterSchema });

export type RequisitionGroupsListSearch = z.infer<typeof requisitionGroupsSearchSchema>;

export const CLEARED_REQUISITION_GROUP_FILTERS = {
  name: undefined,
  zone: undefined,
  program: undefined,
  page: undefined,
} satisfies Partial<RequisitionGroupsListSearch>;

export function toSearchBody(search: RequisitionGroupsListSearch): RequisitionGroupsSearch {
  return {
    ...(search.name?.trim() && { name: search.name.trim() }),
    ...(search.zone?.trim() && { zone: search.zone.trim() }),
    ...(search.program?.trim() && { program: search.program.trim() }),
  };
}

export function toRequisitionGroupsQuery(search: RequisitionGroupsListSearch) {
  const { pageIndex, pageSize } = toPaginationState(search);
  return { ...toSearchBody(search), page: pageIndex, size: pageSize };
}
