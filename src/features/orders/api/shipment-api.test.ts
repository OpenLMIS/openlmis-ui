import { beforeEach, expect, it, vi } from 'vitest';
import {
  cancelOrder,
  confirmShipment,
  createShipmentDraftOnce,
  deleteShipmentDraft,
  fetchPickPackList,
  fetchShipmentSummaries,
  fetchShipmentVvm,
  findShipment,
  findShipmentDraft,
  saveShipmentDraft,
} from '@/features/orders/api/api';
import {
  shipmentDraftOptions,
  shipmentOptions,
  shipmentSummariesOptions,
} from '@/features/orders/api/queries';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import { queryKeys } from '@/lib/key-factory';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/fetch-report', () => ({ fetchReport: vi.fn(), fetchReportFile: vi.fn() }));
let scope = 0;
vi.mock('@/lib/session-scope', () => ({
  getSessionScope: () => scope,
  assertSessionScope: (expected: number) => {
    if (scope !== expected) throw new Error('session ended');
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  scope += 1;
});
const filter = { programId: 'p', facilityId: 'f', orderableIds: ['o'] };
it('keeps filling stock-card fields and keys shipment summaries under stock invalidation', async () => {
  const entry = {
    orderable: { id: 'o' },
    stockOnHand: 8,
    canFulfillForMe: [
      {
        orderable: { id: 'fill' },
        lot: { id: 'lot' },
        stockCard: { id: 'card' },
        stockOnHand: 8,
        active: false,
      },
    ],
  };
  vi.mocked(client.get).mockResolvedValue({ data: { content: [entry], totalPages: 1 } });
  expect(await fetchShipmentSummaries(filter)).toEqual([entry]);
  expect(shipmentSummariesOptions(filter).queryKey).toEqual([
    ...queryKeys.stockCardSummaries.all,
    'shipment',
    'p',
    'f',
    ['o'],
  ]);
  expect(shipmentDraftOptions('o').queryKey).toEqual([
    ...queryKeys.orders.all,
    'shipment-draft',
    'o',
  ]);
  expect(shipmentOptions('o').queryKey).toEqual([...queryKeys.orders.all, 'shipment', 'o']);
});
it('requests VVM only for VVM products in batches of 100 with an explicit size', async () => {
  const cards = Array.from({ length: 101 }, (_, i) => ({
    orderable: { id: 'vvm' },
    stockCard: { id: String(i) },
    stockOnHand: 1,
    active: true,
  }));
  vi.mocked(client.get).mockImplementation(async (_url, config) => ({
    data: {
      content: ((config?.params as { id: string[] } | undefined)?.id ?? []).map((id) => ({
        id,
        extraData: { vvmStatus: 'STAGE_2' },
      })),
      totalPages: 1,
    },
  }));
  const result = await fetchShipmentVvm(
    [
      {
        orderable: { id: 'o' },
        stockOnHand: 1,
        canFulfillForMe: [
          ...cards,
          { ...cards[0], orderable: { id: 'no-vvm' }, stockCard: { id: 'excluded' } },
        ],
      },
    ],
    [{ id: 'vvm', extraData: { useVVM: 'true' } }],
  );
  expect(Object.keys(result)).toHaveLength(101);
  expect(result['0']).toBe('STAGE_2');
  expect(client.get).toHaveBeenCalledTimes(2);
  expect(
    vi
      .mocked(client.get)
      .mock.calls.map(([, config]) => (config?.params as { size: number } | undefined)?.size),
  ).toEqual([100, 1]);
});
it.each([
  'fulfillment.error.shipmentDraft.order.duplicate',
  'fulfillment.error.shipmentDraft.create.orderWithWrongStatus',
])('shares concurrent creates and reads the draft on %s', async (messageKey) => {
  const body = { order: { id: 'o' }, lineItems: [] };
  const error = {
    isAxiosError: true,
    response: { data: { messageKey } },
  };
  vi.mocked(client.post).mockRejectedValue(error);
  vi.mocked(client.get).mockResolvedValue({ data: { content: [{ id: 'draft' }] } });
  const first = createShipmentDraftOnce(body);
  const second = createShipmentDraftOnce(body);
  expect(first).toBe(second);
  expect(await first).toEqual({ id: 'draft' });
  expect(client.post).toHaveBeenCalledTimes(1);
  expect(client.get).toHaveBeenCalledWith('/shipmentDrafts', { params: { orderId: 'o' } });
});
it('does not read a duplicate draft under another session', async () => {
  vi.mocked(client.post).mockImplementation(async () => {
    scope += 1;
    throw {
      isAxiosError: true,
      response: {
        data: { messageKey: 'fulfillment.error.shipmentDraft.create.orderWithWrongStatus' },
      },
    };
  });
  await expect(createShipmentDraftOnce({ order: { id: 'o' }, lineItems: [] })).rejects.toThrow(
    'session ended',
  );
  expect(client.get).not.toHaveBeenCalled();
});
it('uses the fulfillment endpoints and report language', async () => {
  vi.mocked(client.get).mockResolvedValue({ data: { content: [] } });
  vi.mocked(client.put).mockResolvedValue({ data: { id: 'draft' } });
  vi.mocked(client.post).mockResolvedValue({ data: { id: 'shipment' } });
  expect(await findShipmentDraft('o')).toBeNull();
  expect(await findShipment('o')).toBeNull();
  const body = { id: 'draft', order: { id: 'o' }, notes: 'keep', lineItems: [] };
  await saveShipmentDraft(body);
  await deleteShipmentDraft('draft');
  const confirmation = { order: body.order, notes: body.notes, lineItems: body.lineItems };
  await confirmShipment(confirmation);
  await cancelOrder('o');
  await fetchPickPackList('draft', 'ar');
  expect(client.put).toHaveBeenCalledWith('/shipmentDrafts/draft', body);
  expect(client.delete).toHaveBeenCalledWith('/shipmentDrafts/draft');
  expect(client.post).toHaveBeenCalledWith('/shipments', confirmation);
  expect(client.put).toHaveBeenCalledWith('/orders/o/cancel');
  expect(fetchReport).toHaveBeenCalledWith(
    '/reports/templates/common/583ccc35-88b7-48a8-9193-6c4857d3ff60/pdf',
    { shipmentDraftId: 'draft', lang: 'ar' },
  );
});

it('creates again after a completed create and external deletion, sharing only in-flight calls', async () => {
  const body = { order: { id: 'external-delete' }, lineItems: [] };
  vi.mocked(client.post)
    .mockResolvedValueOnce({ data: { id: 'deleted' } })
    .mockResolvedValueOnce({ data: { id: 'fresh' } });
  expect(await createShipmentDraftOnce(body)).toMatchObject({ id: 'deleted' });
  expect(await createShipmentDraftOnce(body)).toMatchObject({ id: 'fresh' });
  expect(client.post).toHaveBeenCalledTimes(2);
});
