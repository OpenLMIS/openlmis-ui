import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { fetchOrder, fetchOrderStockOnHand } from '@/features/orders/api/api';
import { commonNodeIds, supplierIds } from '@/features/orders/lib/supplying-facilities';
import {
  facilitySupervisoryNodesOptions,
  supplyLinesOptions,
} from '@/features/reference-data/api/queries';
import { isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
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
