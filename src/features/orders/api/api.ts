import type { CreateOrderBody, Order } from '@/features/orders/lib/types';
import { client } from '@/integrations/axios';
import { fetchIdBatches } from '@/lib/fetch-by-ids';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

export async function createOrder(body: CreateOrderBody) {
  return (await client.post<Order>('/orders/requisitionLess', body)).data;
}

export async function fetchOrder(id: string): Promise<Order> {
  return (await client.get<Order>(`/orders/${id}`)).data;
}
export async function saveOrder(
  body: import('@/features/orders/lib/order-draft').OrderBody,
): Promise<Order> {
  return (await client.put<Order>(`/orders/${body.id}`, body)).data;
}
export async function sendOrder(body: import('@/features/orders/lib/order-draft').OrderBody) {
  await client.put(`/orders/${body.id}/requisitionLess/send`, body);
}
export async function deleteOrders(ids: readonly string[]) {
  await client.delete('/orders', { data: { ids } });
}
export async function fetchOrderStockOnHand(filter: {
  programId: string;
  facilityId: string;
  orderableIds: readonly string[];
}) {
  const scope = getSessionScope();
  const batches = await fetchIdBatches(filter.orderableIds, async (orderableId) => {
    const entries: { orderable: { id: string }; stockOnHand: number | null }[] = [];
    for (let page = 0; ; page++) {
      assertSessionScope(scope);
      const { data } = await client.get<
        Page<{ canFulfillForMe: { orderable: { id: string }; stockOnHand: number | null }[] }>
      >('/v2/stockCardSummaries', {
        params: {
          programId: filter.programId,
          facilityId: filter.facilityId,
          orderableId,
          page,
          size: 100,
        },
        paramsSerializer: { indexes: null },
      });
      assertSessionScope(scope);
      for (const summary of data.content) entries.push(...summary.canFulfillForMe);
      if (page + 1 >= data.totalPages) break;
    }
    return entries;
  });
  const totals = new Map<string, number | null>();
  for (const entry of batches.flat()) {
    const previous = totals.get(entry.orderable.id);
    totals.set(
      entry.orderable.id,
      previous === null || entry.stockOnHand === null ? null : (previous ?? 0) + entry.stockOnHand,
    );
  }
  return [...totals].map(([id, stockOnHand]) => ({ orderable: { id }, stockOnHand }));
}
