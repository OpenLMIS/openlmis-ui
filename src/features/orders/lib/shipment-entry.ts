import type { QueryClient, QueryKey } from '@tanstack/react-query';
import {
  orderOptions,
  shipmentDraftOptions,
  shipmentOptions,
  shipmentSummariesOptions,
} from '@/features/orders/api/queries';
import type { Order } from '@/features/orders/lib/types';
import { randomId } from '@/lib/random-id';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

type ShipmentEntry = {
  token: string;
  scope: number;
  expires: number;
  order: Order;
  reads: { key: QueryKey; state: ReturnType<QueryClient['getQueryState']> }[];
};
const entries = new WeakMap<QueryClient, ShipmentEntry>();

export const isFulfillable = (order: Order) => ['ORDERED', 'FULFILLING'].includes(order.status);
export const shipmentStockFilter = (order: Order) => ({
  programId: order.program.id,
  facilityId: order.supplyingFacility.id,
  orderableIds: order.orderLineItems.map((line) => line.orderable.id),
});

export async function loadShipmentEntry(client: QueryClient, orderId: string) {
  const scope = getSessionScope();
  const fresh = { staleTime: 0, retry: false } as const;
  const orderQuery = orderOptions(orderId);
  const loadedOrder = await client.fetchQuery({ ...orderQuery, ...fresh });
  assertSessionScope(scope);
  const orderState = client.getQueryState(orderQuery.queryKey);
  const order = client.getQueryData(orderQuery.queryKey) ?? loadedOrder;
  const reads = [
    shipmentSummariesOptions(shipmentStockFilter(order)),
    isFulfillable(order) ? shipmentDraftOptions(orderId) : shipmentOptions(orderId),
  ] as const;
  await Promise.all([
    client.fetchQuery({ ...reads[0], ...fresh }),
    client.fetchQuery({ ...reads[1], ...fresh }),
  ]);
  assertSessionScope(scope);
  const token = randomId();
  entries.set(client, {
    token,
    scope,
    expires: Date.now() + 5_000,
    order,
    reads: [
      { key: orderQuery.queryKey, state: orderState },
      ...reads.map(({ queryKey }) => ({ key: queryKey, state: client.getQueryState(queryKey) })),
    ],
  });
  return token;
}

export function consumeShipmentEntry(client: QueryClient, orderId: string, token?: string) {
  const entry = entries.get(client);
  if (!entry || entry.token !== token) return;
  entries.delete(client);
  if (
    entry.scope === getSessionScope() &&
    entry.expires > Date.now() &&
    entry.order.id === orderId &&
    client.getQueryData(orderOptions(orderId).queryKey) === entry.order &&
    entry.reads.every(
      ({ key, state }) =>
        state?.status === 'success' &&
        state.fetchStatus === 'idle' &&
        !state.isInvalidated &&
        client.getQueryState(key) === state,
    )
  )
    return entry.order;
}

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: router history requires interface merging.
  interface HistoryState {
    shipmentEntry?: string;
  }
}
