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

export const partnerNodeIds = (nodes: readonly SupervisoryNode[]) => [
  ...new Set(nodes.flatMap(({ partnerNodeOf }) => (partnerNodeOf ? [partnerNodeOf.id] : []))),
];

export const groupIdsOf = (partners: readonly SupervisoryNode[]) => [
  ...new Set(
    partners.flatMap(({ requisitionGroup }) => (requisitionGroup ? [requisitionGroup.id] : [])),
  ),
];

export function searchFacilityOptions(
  grants: readonly ProgramGrant[],
  facilities: readonly MinimalFacility[],
  programs: readonly SearchProgram[],
  partnerGroups: readonly RequisitionGroup[],
): SearchFacility[] {
  const result = new Map<string, SearchFacility>();
  const facilitiesById = new Map(facilities.map((facility) => [facility.id, facility]));
  const programsById = new Map(programs.map((program) => [program.id, program]));
  for (const grant of grants) {
    const facility = facilitiesById.get(grant.facilityId);
    if (!facility) continue;
    let option = result.get(facility.id);
    if (!option) {
      option = { id: facility.id, code: facility.code, name: facility.name, programs: [] };
      result.set(facility.id, option);
    }
    const program = programsById.get(grant.programId);
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

export const REQUISITIONS_PAGE_SIZE = 20;
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
export const activeRequisitionFilterCount = (search: RequisitionSearch) =>
  [search.program, search.status, search.initiatedFrom, search.initiatedTo].filter(Boolean).length;
export const hasRequisitionFilters = (search: RequisitionSearch) =>
  activeRequisitionFilterCount(search) > 0;

export function toRequisitionQuery(
  search: RequisitionSearch & { facility: string },
): RequisitionsQuery {
  const { pageIndex, pageSize } = toPaginationState(search, REQUISITIONS_PAGE_SIZE);
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
