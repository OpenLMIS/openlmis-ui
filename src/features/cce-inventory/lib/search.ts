import { z } from 'zod';
import type { InventoryQuery } from '@/features/cce-inventory/lib/types';
import { EQUIPMENT_STATUSES, type EquipmentStatus } from '@/lib/cce-equipment-status';
import {
  type CompleteSelection,
  facilityProgramSearchSchema,
} from '@/lib/facility-program-selection';
import { tableSearchSchema, toPaginationState, toSortParam } from '@/lib/table-search';

export type InventorySortField =
  | 'referenceName'
  | 'equipmentTrackingId'
  | 'type'
  | 'functionalStatus'
  | 'modifiedDate'
  | 'yearOfInstallation';

export const INVENTORY_SORT_FIELDS: readonly [InventorySortField, ...InventorySortField[]] = [
  'referenceName',
  'equipmentTrackingId',
  'type',
  'functionalStatus',
  'modifiedDate',
  'yearOfInstallation',
];

export const INVENTORY_SORT = { id: 'referenceName', desc: false };

export const INVENTORY_PAGE_SIZE = 10;

export const inventorySearchSchema = tableSearchSchema(INVENTORY_SORT_FIELDS).extend({
  ...facilityProgramSearchSchema.shape,
  functionalStatus: z.enum(EQUIPMENT_STATUSES).optional().catch(undefined),
  item: z
    .union([z.literal('new'), z.guid()])
    .optional()
    .catch(undefined),
  action: z.enum(['edit', 'status', 'transfer']).optional().catch(undefined),
});

export type InventorySearch = z.infer<typeof inventorySearchSchema>;

export const CLOSED_INVENTORY_DIALOGS = {
  item: undefined,
  action: undefined,
} satisfies Partial<InventorySearch>;

export const CLEARED_INVENTORY_FILTERS = {
  functionalStatus: undefined,
  page: undefined,
} satisfies Partial<InventorySearch>;

export const hasInventoryFilters = (search: InventorySearch) => Boolean(search.functionalStatus);

export const isInventorySortField = (id: string): id is InventorySortField =>
  INVENTORY_SORT_FIELDS.some((field) => field === id);

function sortParams(search: InventorySearch) {
  const chosen = toSortParam(search, INVENTORY_SORT);
  const tieBreakers = chosen.startsWith('referenceName,')
    ? ['id,asc']
    : ['referenceName,asc', 'id,asc'];
  return [chosen, ...tieBreakers];
}

export function toInventoryQuery(
  search: InventorySearch,
  { facilityId, programId }: { facilityId: string; programId: string },
): InventoryQuery {
  const { pageIndex, pageSize } = toPaginationState(search, INVENTORY_PAGE_SIZE);
  return {
    facilityId,
    programId,
    page: pageIndex,
    size: pageSize,
    sort: sortParams(search),
    ...(search.functionalStatus && { functionalStatus: search.functionalStatus }),
  };
}

export function inventorySavedSearch(
  listSearch: InventorySearch,
  { mode, programId, facilityId }: CompleteSelection,
  savedStatus: EquipmentStatus,
): InventorySearch {
  const { page, functionalStatus, item, action, ...kept } = listSearch;
  return {
    ...kept,
    mode,
    programId,
    facilityId,
    ...(functionalStatus === savedStatus && { functionalStatus }),
  };
}
