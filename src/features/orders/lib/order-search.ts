import { z } from 'zod';
import { ORDER_KINDS, type OrderKind } from '@/features/orders/lib/order-status';
import {
  dateFilterSchema,
  tableSearchSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

export const ORDER_SORT_FIELDS = ['orderCode', 'emergency', 'createdDate'] as const;
export const isOrderSortField = (id: string): id is (typeof ORDER_SORT_FIELDS)[number] =>
  ORDER_SORT_FIELDS.some((field) => field === id);
export const ORDER_DEFAULT_SORT = { id: 'createdDate', desc: true };
export const uuidFilter = z.uuid().optional().catch(undefined);
const statusFilter = <T extends string>(statuses: readonly T[]) =>
  z.string().toUpperCase().pipe(z.enum(statuses)).optional().catch(undefined);
export const ORDER_FILTERS = {
  requestingFacilityId: uuidFilter,
  programId: uuidFilter,
};

export const viewOrdersSearchSchema = tableSearchSchema(ORDER_SORT_FIELDS).extend({
  ...ORDER_FILTERS,
  supplyingFacilityId: uuidFilter,
  status: statusFilter(ORDER_KINDS.view.filterStatuses),
  periodStart: dateFilterSchema,
  periodEnd: dateFilterSchema,
});
export const fulfillOrdersSearchSchema = tableSearchSchema(ORDER_SORT_FIELDS).extend({
  ...ORDER_FILTERS,
  status: statusFilter(ORDER_KINDS.fulfill.filterStatuses),
});
export type ViewOrdersSearch = z.infer<typeof viewOrdersSearchSchema>;
export type FulfillOrdersSearch = z.infer<typeof fulfillOrdersSearchSchema>;

export type { PodListSearch } from '@/features/orders/lib/pod-search';

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
