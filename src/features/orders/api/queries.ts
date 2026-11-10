import { type QueryClient, queryOptions } from '@tanstack/react-query';
import {
  fetchOrder,
  fetchOrderRequestingFacilityIds,
  fetchOrderStockOnHand,
  fetchShipmentSummaries,
  fetchShipmentVvm,
  findShipment,
  findShipmentDraft,
  searchOrders,
  shipmentVvmCardIds,
} from '@/features/orders/api/api';
import type { OrderSearchParams } from '@/features/orders/lib/order-search';
import type {
  ShipmentSavedLine,
  ShipmentStockFilter,
  ShipmentSummary,
} from '@/features/orders/lib/shipment-types';
import {
  commonNodeIds,
  supplierIds,
  viewOrderSupplierIds,
} from '@/features/orders/lib/supplying-facilities';
import type { OrderProduct } from '@/features/orders/lib/types';
import {
  facilitiesByIdsOptions,
  facilitySupervisoryNodesOptions,
  LOOKUP_STALE_TIME,
  lotsByIdsOptions,
  minimalFacilitiesOptions,
  orderablesByIdentitiesOptions,
  orderablesByIdsOptions,
  supplyLinesOptions,
} from '@/features/reference-data/api/queries';
import { isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import type { Permissions } from '@/lib/permissions';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const supplyingFacilitiesOptions = (programId: string, facilityIds: readonly string[]) =>
  queryOptions({
    queryKey: [...queryKeys.orders.all, 'suppliers', programId, facilityIds.toSorted()],
    queryFn: async ({ client }) => {
      const scope = getSessionScope();
      const nodes = await Promise.all(
        facilityIds.map((facilityId) =>
          client.fetchQuery(facilitySupervisoryNodesOptions({ programId, facilityId })),
        ),
      );
      assertSessionScope(scope);
      const lines = await Promise.all(
        commonNodeIds(nodes).map((supervisoryNodeId) =>
          client.fetchQuery(supplyLinesOptions({ programId, supervisoryNodeId })),
        ),
      );
      assertSessionScope(scope);
      return supplierIds(lines.flat());
    },
  });

export const orderOptions = (id: string) =>
  queryOptions({ queryKey: queryKeys.orders.detail(id), queryFn: () => fetchOrder(id) });
type StockFilter = { programId: string; facilityId: string; orderableIds: readonly string[] };
const STOCK_FRESHNESS = 30_000;
const balanceKey = (filter: StockFilter, id: string) => [
  ...queryKeys.stockCardSummaries.all,
  'order-balance',
  filter.programId,
  filter.facilityId,
  id,
];
export function cachedOrderBalance(client: QueryClient, filter: StockFilter, id: string) {
  const state = client.getQueryState<number | null>(balanceKey(filter, id));
  return state && !state.isInvalidated && Date.now() - state.dataUpdatedAt < STOCK_FRESHNESS
    ? state.data
    : undefined;
}
export const orderStockOnHandOptions = (filter: StockFilter) =>
  queryOptions({
    queryKey: [
      ...queryKeys.stockCardSummaries.all,
      'orders',
      { ...filter, orderableIds: filter.orderableIds.toSorted() },
    ],
    enabled: filter.orderableIds.length > 0,
    retry: false,
    queryFn: async ({ client }) => {
      const scope = getSessionScope();
      const ids = [...new Set(filter.orderableIds)];
      const missing = ids.filter((id) => cachedOrderBalance(client, filter, id) === undefined);
      if (missing.length) {
        const unread = missing.filter(
          (id) => client.getQueryState(balanceKey(filter, id))?.fetchStatus !== 'fetching',
        );
        const read = async () => {
          try {
            const balances = await fetchOrderStockOnHand({ ...filter, orderableIds: unread });
            assertSessionScope(scope);
            return balances;
          } catch (error) {
            assertSessionScope(scope);
            if (!isRefused(error)) throw error;
            return unread.map((id) => ({ orderable: { id }, stockOnHand: null }));
          }
        };
        const batch = unread.length ? read() : Promise.resolve([]);
        await Promise.all(
          missing.map((id) =>
            client.fetchQuery({
              queryKey: balanceKey(filter, id),
              staleTime: STOCK_FRESHNESS,
              retry: false,
              queryFn: async () => {
                const balances = await batch;
                assertSessionScope(scope);
                return balances.find((item) => item.orderable.id === id)?.stockOnHand ?? null;
              },
            }),
          ),
        );
        assertSessionScope(scope);
      }
      return ids.map((id) => ({
        orderable: { id },
        stockOnHand: client.getQueryData<number | null>(balanceKey(filter, id)) ?? null,
      }));
    },
  });

export const ordersSearchOptions = (params: OrderSearchParams) =>
  queryOptions({ queryKey: queryKeys.orders.list(params), queryFn: () => searchOrders(params) });

export const orderRequestingFacilitiesOptions = (ids: readonly string[]) =>
  queryOptions({
    queryKey: [...queryKeys.orders.all, 'requesting-facilities', ids.toSorted()],
    enabled: ids.length > 0,
    queryFn: () => fetchOrderRequestingFacilityIds(ids),
  });

export function viewSupplierFacilitiesOptions(permissions: Permissions) {
  const ids = viewOrderSupplierIds(permissions);
  return queryOptions({
    queryKey: [...queryKeys.facilities.all, 'order-suppliers', ids],
    staleTime: LOOKUP_STALE_TIME,
    queryFn: async ({ client }) => {
      const cached = client.getQueryData(minimalFacilitiesOptions().queryKey);
      if (cached) return cached;
      if (ids.length > 100) return client.fetchQuery(minimalFacilitiesOptions());
      const facilities = await client.fetchQuery(facilitiesByIdsOptions(ids));
      return facilities.map(({ id, code, name, active }) => ({
        id,
        code,
        name: name ?? code,
        active,
      }));
    },
  });
}

export const shipmentSummariesOptions = (filter: ShipmentStockFilter) =>
  queryOptions({
    queryKey: [
      ...queryKeys.stockCardSummaries.all,
      'shipment',
      filter.programId,
      filter.facilityId,
      [...new Set(filter.orderableIds)].toSorted(),
    ],
    queryFn: () => fetchShipmentSummaries(filter),
  });
export const shipmentDraftOptions = (orderId: string) =>
  queryOptions({
    queryKey: [...queryKeys.orders.all, 'shipment-draft', orderId],
    queryFn: () => findShipmentDraft(orderId),
  });
export const shipmentOptions = (orderId: string) =>
  queryOptions({
    queryKey: [...queryKeys.orders.all, 'shipment', orderId],
    queryFn: () => findShipment(orderId),
  });
export const shipmentProductsOptions = (summaries: readonly ShipmentSummary[]) =>
  orderablesByIdsOptions([
    ...new Set(
      summaries.flatMap((summary) =>
        (summary.canFulfillForMe ?? []).map((card) => card.orderable.id),
      ),
    ),
  ]);
export const shipmentSavedProductsOptions = (lines: readonly ShipmentSavedLine[]) =>
  orderablesByIdentitiesOptions(lines.map((line) => line.orderable));
export const shipmentLotsOptions = (
  summaries: readonly ShipmentSummary[],
  savedLines: readonly ShipmentSavedLine[] = [],
) =>
  lotsByIdsOptions([
    ...new Set([
      ...summaries.flatMap((summary) =>
        (summary.canFulfillForMe ?? []).flatMap((card) => (card.lot ? [card.lot.id] : [])),
      ),
      ...savedLines.flatMap((line) => (line.lot ? [line.lot.id] : [])),
    ]),
  ]);
export const shipmentVvmOptions = (
  summaries: readonly ShipmentSummary[],
  products: readonly OrderProduct[],
) =>
  queryOptions({
    queryKey: [
      ...queryKeys.stockCardSummaries.all,
      'shipment-vvm',
      shipmentVvmCardIds(summaries, products),
    ],
    queryFn: () => fetchShipmentVvm(summaries, products),
  });
