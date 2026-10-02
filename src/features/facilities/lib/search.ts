import { z } from 'zod';
import type { FacilitiesQuery } from '@/features/facilities/lib/types';
import {
  type DefaultSort,
  tableSearchSchema,
  textFilterSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

export const FACILITY_HIDEABLE_COLUMNS = [
  { id: 'geographicZone', labelKey: 'facilities.zone', hideBelow: 'xl' },
  { id: 'type', labelKey: 'facilities.type', hideBelow: '2xl' },
  { id: 'active', labelKey: 'facilities.active', hideBelow: '3xl' },
  { id: 'enabled', labelKey: 'facilities.enabled', hideBelow: '4xl' },
] as const;

const FACILITY_SORT_FIELDS = ['name', 'code', 'active', 'enabled'] as const;

export const DEFAULT_FACILITIES_SORT: DefaultSort = { id: 'name', desc: false };

export const facilitiesSearchSchema = tableSearchSchema(FACILITY_SORT_FIELDS).extend({
  name: textFilterSchema,
  zoneId: z.guid().optional().catch(undefined),
});

export type FacilitiesSearch = z.infer<typeof facilitiesSearchSchema>;

export const CLEARED_FACILITY_FILTERS = {
  name: undefined,
  zoneId: undefined,
  page: undefined,
} satisfies Partial<FacilitiesSearch>;

export function hasFacilityFilters(search: FacilitiesSearch) {
  return Boolean(search.name || search.zoneId);
}

export function toFacilitiesQuery(search: FacilitiesSearch): FacilitiesQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    sort: toSortParam(search, DEFAULT_FACILITIES_SORT),
    ...(search.name?.trim() && { name: search.name.trim() }),
    ...(search.zoneId && { zoneId: search.zoneId }),
  };
}
