import { z } from 'zod';
import { ORDER_KINDS, type OrderKind } from '@/features/orders/lib/order-status';
import {
  dateFilterSchema,
  type TableSearch,
  tableSearchSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

export const ORDER_SORT_FIELDS = ['orderCode', 'emergency', 'createdDate'] as const;
export const isOrderSortField = (id: string): id is (typeof ORDER_SORT_FIELDS)[number] =>
  ORDER_SORT_FIELDS.some((field) => field === id);
export const ORDER_DEFAULT_SORT = { id: 'createdDate', desc: true };
const uuidFilter = z.uuid().optional().catch(undefined);
const statusFilter = <T extends string>(statuses: readonly T[]) =>
  z.string().toUpperCase().pipe(z.enum(statuses)).optional().catch(undefined);
const filters = {
  requestingFacilityId: uuidFilter,
  programId: uuidFilter,
};

export const viewOrdersSearchSchema = tableSearchSchema(ORDER_SORT_FIELDS).extend({
  ...filters,
  supplyingFacilityId: uuidFilter,
  status: statusFilter(ORDER_KINDS.view.filterStatuses),
  periodStart: dateFilterSchema,
  periodEnd: dateFilterSchema,
});
export const fulfillOrdersSearchSchema = tableSearchSchema(ORDER_SORT_FIELDS).extend({
  ...filters,
  status: statusFilter(ORDER_KINDS.fulfill.filterStatuses),
});
export type ViewOrdersSearch = z.infer<typeof viewOrdersSearchSchema>;
export type FulfillOrdersSearch = z.infer<typeof fulfillOrdersSearchSchema>;

export type PodListSearch = TableSearch & {
  sort?: (typeof ORDER_SORT_FIELDS)[number];
  programId?: string;
  requestingFacilityId?: string;
  supplyingFacilityId?: string;
};

export const invalidDateRange = ({ periodStart, periodEnd }: ViewOrdersSearch) =>
  Boolean(periodStart && periodEnd && periodStart > periodEnd);

export function toOrderParams(search: ViewOrdersSearch, kind: OrderKind = 'view') {
  const { pageIndex, pageSize } = toPaginationState(search);
  const sort = toSortParam(search, ORDER_DEFAULT_SORT);
  return {
    supplyingFacilityId: search.supplyingFacilityId,
    requestingFacilityId: search.requestingFacilityId,
    programId: search.programId,
    status: search.status ? [search.status] : ORDER_KINDS[kind].defaultStatuses,
    periodStartDate: search.periodStart,
    periodEndDate: search.periodEnd,
    page: pageIndex,
    size: pageSize,
    sort: [sort, ...(sort.startsWith('createdDate,') ? [] : ['createdDate,desc']), 'id,asc'],
  };
}
export type OrderSearchParams = ReturnType<typeof toOrderParams>;
