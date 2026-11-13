import type { QueryClient } from '@tanstack/react-query';
import {
  orderOptions,
  shipmentDraftOptions,
  shipmentOptions,
  shipmentSummariesOptions,
} from '@/features/orders/api/queries';
import type { Order } from '@/features/orders/lib/types';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const isFulfillable = (order: Order) => ['ORDERED', 'FULFILLING'].includes(order.status);
export const shipmentStockFilter = (order: Order) => ({
  programId: order.program.id,
  facilityId: order.supplyingFacility.id,
  orderableIds: order.orderLineItems.map((line) => line.orderable.id),
});

export async function loadShipmentEntry(client: QueryClient, orderId: string) {
  const scope = getSessionScope();
  const fresh = { staleTime: 0, retry: false } as const;
  const order = await client.fetchQuery({ ...orderOptions(orderId), ...fresh });
  assertSessionScope(scope);
  await Promise.all([
    client.fetchQuery({ ...shipmentSummariesOptions(shipmentStockFilter(order)), ...fresh }),
    client.fetchQuery({
      ...(isFulfillable(order) ? shipmentDraftOptions(orderId) : shipmentOptions(orderId)),
      ...fresh,
    }),
  ]);
  assertSessionScope(scope);
}
