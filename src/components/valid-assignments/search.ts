import { z } from 'zod';
import type { AssignmentsQuery } from '@/components/valid-assignments/types';
import { tableSearchSchema, toPaginationState } from '@/lib/table-search';

export const ASSIGNMENT_HIDEABLE_COLUMNS = [
  { id: 'facilityType', labelKey: 'valid-assignments.facility-type', hideBelow: 'lg' },
  { id: 'geoZone', labelKey: 'valid-assignments.geo-zone', hideBelow: 'xl' },
  { id: 'geoLevelAffinity', labelKey: 'valid-assignments.geo-level-affinity', hideBelow: '3xl' },
] as const;

/** The API cannot sort by name, and pages repeat rows without some order. */
const STABLE_ORDER = ['programId,asc', 'facilityTypeId,asc', 'id,asc'];

const idSchema = z.guid().optional().catch(undefined);

export const assignmentsSearchSchema = tableSearchSchema(['name'])
  .omit({ sort: true, dir: true })
  .extend({
    /** The facility doing the issuing or receiving, not the row's name. */
    facilityId: idSchema,
    programId: idSchema,
    assignment: z.literal('new').optional().catch(undefined),
  });

export type AssignmentsSearch = z.infer<typeof assignmentsSearchSchema>;

export const CLEARED_ASSIGNMENT_FILTERS = {
  facilityId: undefined,
  programId: undefined,
  page: undefined,
} satisfies Partial<AssignmentsSearch>;

export const hasAssignmentFilters = (search: AssignmentsSearch) =>
  Boolean(search.facilityId || search.programId);

export const assignmentFilterKey = (search: AssignmentsSearch) =>
  `${search.facilityId ?? ''}|${search.programId ?? ''}`;

/** The server takes the facility and the program only as a pair. */
export const isHalfFiltered = (search: AssignmentsSearch) =>
  Boolean(search.facilityId) !== Boolean(search.programId);

export function toAssignmentsQuery(search: AssignmentsSearch): AssignmentsQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  const query: AssignmentsQuery = { page: pageIndex, size: pageSize, sort: STABLE_ORDER };
  if (search.facilityId && search.programId) {
    query.facilityId = search.facilityId;
    query.programId = search.programId;
  }
  return query;
}
