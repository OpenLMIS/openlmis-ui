import type { OrderBody } from '@/features/orders/lib/order-draft';
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
export async function saveOrder(body: OrderBody): Promise<Order> {
  return (await client.put<Order>(`/orders/${body.id}`, body)).data;
}
export async function sendOrder(body: OrderBody) {
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
    const entries: {
      orderable: { id: string };
      stockOnHand: number | null;
    }[] = [];
    for (let page = 0; ; page++) {
      assertSessionScope(scope);
      const { data } = await client.get<
        Page<{ orderable: { id: string }; stockOnHand: number | null }>
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
      entries.push(
        ...data.content.map(({ orderable, stockOnHand }) => ({
          orderable: { id: orderable.id },
          stockOnHand,
        })),
      );
      if (page + 1 >= data.totalPages) break;
    }
    return entries;
  });
  const balances = new Map(batches.flat().map((summary) => [summary.orderable.id, summary]));
  return [...new Set(filter.orderableIds)].map(
    (id) => balances.get(id) ?? { orderable: { id }, stockOnHand: 0 },
  );
}
