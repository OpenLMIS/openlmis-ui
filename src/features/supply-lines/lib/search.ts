import { z } from 'zod';
import type { SupplyLinesQuery } from '@/features/supply-lines/lib/types';
import {
  type DefaultSort,
  tableSearchSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

export const SUPPLY_LINE_HIDEABLE_COLUMNS = [
  { id: 'supervisoryNode.code', labelKey: 'supply-lines.supervisory-node' },
  { id: 'program.name', labelKey: 'supply-lines.program', hideBelow: 480 },
] as const;

const SUPPLY_LINE_SORT_FIELDS = [
  'supplyingFacility.name',
  'supervisoryNode.code',
  'program.name',
] as const;

export const DEFAULT_SUPPLY_LINES_SORT: DefaultSort = {
  id: 'supplyingFacility.name',
  desc: false,
};

export const supplyLinesSearchSchema = tableSearchSchema(SUPPLY_LINE_SORT_FIELDS).extend({
  supplyingFacilityId: z.guid().optional().catch(undefined),
  programId: z.guid().optional().catch(undefined),
});

export type SupplyLinesSearch = z.infer<typeof supplyLinesSearchSchema>;

export const CLEARED_SUPPLY_LINE_FILTERS = {
  supplyingFacilityId: undefined,
  programId: undefined,
  page: undefined,
} satisfies Partial<SupplyLinesSearch>;

export function hasSupplyLineFilters(search: SupplyLinesSearch) {
  return Boolean(search.supplyingFacilityId || search.programId);
}

export function toSupplyLinesQuery(search: SupplyLinesSearch): SupplyLinesQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    sort: toSortParam(search, DEFAULT_SUPPLY_LINES_SORT),
    ...(search.supplyingFacilityId && { supplyingFacilityId: search.supplyingFacilityId }),
    ...(search.programId && { programId: search.programId }),
  };
}
