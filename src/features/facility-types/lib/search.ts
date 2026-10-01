import { z } from 'zod';
import type { FacilityTypesQuery } from '@/features/facility-types/lib/types';
import {
  type DefaultSort,
  tableSearchSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

export const FACILITY_TYPE_HIDEABLE_COLUMNS = [
  { id: 'displayOrder', labelKey: 'facility-types.display-order', hideBelow: 'lg' },
  { id: 'active', labelKey: 'facility-types.status', hideBelow: 'md' },
] as const;

const FACILITY_TYPE_SORT_FIELDS = ['displayOrder', 'code', 'name', 'active'] as const;

export const DEFAULT_FACILITY_TYPES_SORT: DefaultSort = { id: 'displayOrder', desc: false };

export const facilityTypesSearchSchema = tableSearchSchema(FACILITY_TYPE_SORT_FIELDS).extend({
  facilityType: z
    .union([z.literal('new'), z.guid()])
    .optional()
    .catch(undefined),
});

export type FacilityTypesSearch = z.infer<typeof facilityTypesSearchSchema>;

export function toFacilityTypesQuery(search: FacilityTypesSearch): FacilityTypesQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    sort: toSortParam(search, DEFAULT_FACILITY_TYPES_SORT),
  };
}
