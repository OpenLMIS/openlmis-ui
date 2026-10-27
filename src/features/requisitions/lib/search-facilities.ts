import { z } from 'zod';
import type {
  MinimalFacility,
  RequisitionGroup,
  SupervisoryNode,
} from '@/features/reference-data/lib/types';
import type { RequisitionsQuery } from '@/features/requisitions/lib/types';
import type { NamedRecord } from '@/lib/facility-program-selection';
import type { ProgramGrant } from '@/lib/permissions';
import { REQUISITION_STATUSES } from '@/lib/requisition-status';
import {
  dateFilterSchema,
  tableSearchSchema,
  textFilterSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

export type SearchProgram = Pick<NamedRecord, 'id' | 'name'>;
export type SearchFacility = NamedRecord & { programs: SearchProgram[] };

export function partnerLookupIds(
  nodes: readonly SupervisoryNode[],
  partners: readonly SupervisoryNode[] = [],
) {
  return {
    partnerIds: [
      ...new Set(nodes.flatMap(({ partnerNodeOf }) => (partnerNodeOf ? [partnerNodeOf.id] : []))),
    ],
    groupIds: [
      ...new Set(
        partners.flatMap(({ requisitionGroup }) => (requisitionGroup ? [requisitionGroup.id] : [])),
      ),
    ],
  };
}

export function searchFacilityOptions(
  grants: readonly ProgramGrant[],
  facilities: readonly MinimalFacility[],
  programs: readonly SearchProgram[],
  partnerGroups: readonly RequisitionGroup[],
): SearchFacility[] {
  const result = new Map<string, SearchFacility>();
  for (const grant of grants) {
    const facility = facilities.find(({ id }) => id === grant.facilityId);
    if (!facility) continue;
    let option = result.get(facility.id);
    if (!option) {
      option = { id: facility.id, code: facility.code, name: facility.name, programs: [] };
      result.set(facility.id, option);
    }
    const program = programs.find(({ id }) => id === grant.programId);
    if (program && !option.programs.some(({ id }) => id === program.id))
      option.programs.push({ id: program.id, name: program.name });
  }
  for (const group of partnerGroups) {
    for (const facility of group.memberFacilities) {
      if (!result.has(facility.id))
        result.set(facility.id, {
          id: facility.id,
          code: facility.code,
          name: facility.name,
          programs: (facility.supportedPrograms ?? []).map(({ id, name }) => ({ id, name })),
        });
    }
  }
  return [...result.values()].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }),
  );
}

export const REQUISITIONS_SORT = { id: 'createdDate', desc: true };
export const requisitionSearchSchema = tableSearchSchema(['createdDate']).extend({
  facility: textFilterSchema,
  program: textFilterSchema,
  status: z.enum(REQUISITION_STATUSES).optional().catch(undefined),
  initiatedFrom: dateFilterSchema,
  initiatedTo: dateFilterSchema,
});
export type RequisitionSearch = z.infer<typeof requisitionSearchSchema>;
export const invalidDateRange = (search: RequisitionSearch) =>
  Boolean(search.initiatedFrom && search.initiatedTo && search.initiatedFrom > search.initiatedTo);
export const CLEARED_REQUISITION_FILTERS = {
  program: undefined,
  status: undefined,
  initiatedFrom: undefined,
  initiatedTo: undefined,
  page: undefined,
};
export const hasRequisitionFilters = (search: RequisitionSearch) =>
  Boolean(search.program || search.status || search.initiatedFrom || search.initiatedTo);

export function toRequisitionQuery(
  search: RequisitionSearch & { facility: string },
): RequisitionsQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    facility: search.facility,
    ...(search.program && { program: search.program }),
    ...(search.status && { requisitionStatus: search.status }),
    ...(search.initiatedFrom && { initiatedDateFrom: search.initiatedFrom }),
    ...(search.initiatedTo && { initiatedDateTo: search.initiatedTo }),
    page: pageIndex,
    size: pageSize,
    sort: [toSortParam(search, REQUISITIONS_SORT), 'id'],
  };
}
