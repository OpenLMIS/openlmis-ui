import { isAxiosError } from 'axios';
import type { OrderBody } from '@/features/orders/lib/order-draft';
import type { OrderSearchParams } from '@/features/orders/lib/order-search';
import type { PodBody, PodResponse, ProofOfDelivery } from '@/features/orders/lib/pod-types';
import type {
  ShipmentBody,
  ShipmentDraftBody,
  ShipmentRecord,
  ShipmentSummary,
} from '@/features/orders/lib/shipment-types';
import type {
  CreateOrderBody,
  Order,
  OrderProduct,
  OrderStockFilter,
  OrdersPage,
} from '@/features/orders/lib/types';
import { client } from '@/integrations/axios';
import { fetchByIds, fetchIdBatches } from '@/lib/fetch-by-ids';
import { fetchReport, fetchReportFile } from '@/lib/fetch-report';
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
export async function fetchShipmentSummaries(filter: OrderStockFilter): Promise<ShipmentSummary[]> {
  const scope = getSessionScope();
  const batches = await fetchIdBatches(filter.orderableIds, async (orderableId) => {
    const entries: ShipmentSummary[] = [];
    for (let page = 0; ; page++) {
      assertSessionScope(scope);
      const { data } = await client.get<Page<ShipmentSummary>>('/v2/stockCardSummaries', {
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
      entries.push(...data.content);
      if (page + 1 >= data.totalPages) break;
    }
    return entries;
  });
  assertSessionScope(scope);
  return batches.flat();
}

export async function fetchOrderStockOnHand(filter: OrderStockFilter) {
  const scope = getSessionScope();
  const summaries = await fetchShipmentSummaries(filter);
  assertSessionScope(scope);
  const balances = new Map(
    summaries.map(({ orderable, stockOnHand }) => [
      orderable.id,
      { orderable: { id: orderable.id }, stockOnHand },
    ]),
  );
  return [...new Set(filter.orderableIds)].map(
    (id) => balances.get(id) ?? { orderable: { id }, stockOnHand: 0 },
  );
}

export function shipmentVvmCardIds(
  summaries: readonly ShipmentSummary[],
  products: readonly OrderProduct[],
) {
  const enabled = new Set(
    products.filter((product) => product.extraData?.useVVM === 'true').map((product) => product.id),
  );
  return [
    ...new Set(
      summaries.flatMap((summary) =>
        (summary.canFulfillForMe ?? [])
          .filter((card) => enabled.has(card.orderable.id))
          .map((card) => card.stockCard.id),
      ),
    ),
  ].toSorted();
}

export async function fetchShipmentVvm(
  summaries: readonly ShipmentSummary[],
  products: readonly OrderProduct[],
): Promise<Record<string, string | null>> {
  const cards = await fetchByIds<{ id: string; extraData?: { vvmStatus?: string | null } }>(
    '/stockCards',
    shipmentVvmCardIds(summaries, products),
  );
  return Object.fromEntries(cards.map((card) => [card.id, card.extraData?.vvmStatus ?? null]));
}

export async function findShipmentDraft(orderId: string): Promise<ShipmentRecord | null> {
  const { data } = await client.get<Page<ShipmentRecord>>('/shipmentDrafts', {
    params: { orderId },
  });
  return data.content[0] ?? null;
}

export async function findShipment(orderId: string): Promise<ShipmentRecord | null> {
  const { data } = await client.get<Page<ShipmentRecord>>('/shipments', { params: { orderId } });
  return data.content[0] ?? null;
}

const draftCreates = new Map<string, Promise<ShipmentRecord>>();
export function createShipmentDraftOnce(body: ShipmentBody): Promise<ShipmentRecord> {
  const scope = getSessionScope();
  const key = JSON.stringify([scope, body.order.id]);
  const current = draftCreates.get(key);
  if (current) return current;
  const create = async () => {
    assertSessionScope(scope);
    try {
      const { data } = await client.post<ShipmentRecord>('/shipmentDrafts', body);
      assertSessionScope(scope);
      return data;
    } catch (error) {
      assertSessionScope(scope);
      const messageKey = isAxiosError(error) ? error.response?.data?.messageKey : undefined;
      if (
        ![
          'fulfillment.error.shipmentDraft.create.orderWithWrongStatus',
          'fulfillment.error.shipmentDraft.order.duplicate',
        ].includes(messageKey)
      )
        throw error;
      const existing = await findShipmentDraft(body.order.id);
      assertSessionScope(scope);
      if (!existing) throw error;
      return existing;
    }
  };
  const request = create().finally(() => {
    draftCreates.delete(key);
  });
  draftCreates.set(key, request);
  return request;
}

export async function saveShipmentDraft(body: ShipmentDraftBody) {
  return (await client.put<ShipmentRecord>(`/shipmentDrafts/${body.id}`, body)).data;
}
export async function deleteShipmentDraft(id: string) {
  await client.delete(`/shipmentDrafts/${id}`);
}
export async function confirmShipment(body: ShipmentBody) {
  return (await client.post<ShipmentRecord>('/shipments', body)).data;
}
export async function cancelOrder(id: string) {
  return (await client.put<Order>(`/orders/${id}/cancel`)).data;
}
export function fetchPickPackList(shipmentDraftId: string, lang: string) {
  return fetchReport('/reports/templates/common/583ccc35-88b7-48a8-9193-6c4857d3ff60/pdf', {
    shipmentDraftId,
    lang,
  });
}

export async function searchOrders(params: OrderSearchParams): Promise<OrdersPage> {
  return (
    await client.get<OrdersPage>('/orders', {
      params,
      paramsSerializer: { indexes: null },
    })
  ).data;
}

export async function fetchOrderRequestingFacilityIds(ids: readonly string[]): Promise<string[]> {
  if (!ids.length) return [];
  return (
    await client.get<string[]>('/orders/requestingFacilities', {
      params: { supplyingFacilityId: ids },
      paramsSerializer: { indexes: null },
    })
  ).data;
}

export function fetchOrderPdf(id: string, language: string) {
  return fetchReport(`/orders/${id}/print`, { format: 'pdf', lang: language });
}

export function fetchOrderCsv(id: string) {
  return fetchReportFile(`/orders/${id}/export`, { type: 'csv' });
}

export async function retryOrderTransfer(id: string) {
  return (await client.get<{ result: boolean }>(`/orders/${id}/retry`)).data;
}

export async function fetchProofOfDelivery(id: string): Promise<ProofOfDelivery> {
  return (
    await client.get<ProofOfDelivery>(`/proofsOfDelivery/${id}`, {
      params: { expand: 'shipment.order' },
    })
  ).data;
}
export async function findProofOfDelivery(orderId: string): Promise<PodResponse | null> {
  const { data } = await client.get<Page<PodResponse>>('/proofsOfDelivery', {
    params: { orderId },
  });
  return data.content[0] ?? null;
}
export async function saveProofOfDelivery(id: string, body: PodBody): Promise<PodResponse> {
  return (await client.put<PodResponse>(`/proofsOfDelivery/${id}`, body)).data;
}
export function fetchProofOfDeliveryPdf(id: string, lang: string) {
  return fetchReport(`/proofsOfDelivery/${id}/print`, { format: 'pdf', lang });
}
