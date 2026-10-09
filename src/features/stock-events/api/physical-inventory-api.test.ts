import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLotsByIds, fetchOrderablesByIds } from '@/features/reference-data/api/api';
import {
  createPhysicalInventoryLot,
  deletePhysicalInventory,
  fetchInventoryStockLines,
  fetchInventorySummaries,
  fetchPhysicalInventoryDraft,
  fetchPhysicalInventoryReport,
  savePhysicalInventory,
  startPhysicalInventory,
  submitPhysicalInventory,
} from '@/features/stock-events/api/physical-inventory-api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchLotsByIds: vi.fn(),
  fetchOrderablesByIds: vi.fn(),
  fetchOrderableFulfills: vi.fn(),
  fetchLotsByTradeItems: vi.fn(),
}));
const scope = { programId: 'p', facilityId: 'f' };
beforeEach(() => vi.clearAllMocks());
describe('physical inventory reads and start', () => {
  it('reads the first draft with legacy parameter names and returns null if absent', async () => {
    vi.mocked(client.get)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 'draft', ...scope, lineItems: [] }] });
    expect(await fetchPhysicalInventoryDraft(scope)).toBeNull();
    expect(await fetchPhysicalInventoryDraft(scope)).toMatchObject({ id: 'draft' });
    expect(client.get).toHaveBeenCalledWith('/physicalInventories', {
      params: { program: 'p', facility: 'f', isDraft: true },
    });
  });
  it('creates only a draft with the program and facility', async () => {
    vi.mocked(client.post).mockResolvedValue({ data: { id: 'new', ...scope } });
    expect(await startPhysicalInventory(scope)).toMatchObject({ id: 'new' });
    expect(client.post).toHaveBeenCalledWith('/physicalInventories', scope);
  });
  it('hydrates all stock and draft identities, retaining saved stockless counts', async () => {
    vi.mocked(client.get).mockResolvedValue({
      data: {
        content: [
          {
            orderable: { id: 'o' },
            canFulfillForMe: [
              {
                orderable: { id: 'o' },
                lot: null,
                stockCard: { id: 'card' },
                stockOnHand: 0,
                active: false,
              },
            ],
          },
        ],
      },
    });
    const product = (id: string) => ({
      id,
      productCode: id,
      fullProductName: id,
      description: null,
    });
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([product('o'), product('saved')]);
    vi.mocked(fetchLotsByIds).mockResolvedValue([
      { id: 'lot', lotCode: 'Lot', expirationDate: null },
    ]);
    const summaries = await fetchInventorySummaries(scope);
    const result = await fetchInventoryStockLines(
      scope,
      [{ orderableId: 'saved', lotId: 'lot', quantity: 3 }],
      summaries,
    );
    expect(client.get).toHaveBeenCalledWith('/v2/stockCardSummaries', {
      params: scope,
    });
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(fetchOrderablesByIds).toHaveBeenCalledWith(['o', 'saved']);
    expect(fetchLotsByIds).toHaveBeenCalledWith(['lot']);
    expect(result).toEqual([
      expect.objectContaining({ stockCardId: 'card', active: false, stockOnHand: 0 }),
      expect.objectContaining({
        orderable: product('saved'),
        lot: expect.objectContaining({ id: 'lot' }),
        stockOnHand: null,
      }),
    ]);
  });
});

it('uses legacy save, delete, lot and stock event endpoints', async () => {
  vi.mocked(client.put).mockResolvedValue({ data: {} });
  vi.mocked(client.delete).mockResolvedValue({});
  vi.mocked(client.post).mockResolvedValue({ data: { id: 'created' } });
  const body = { id: 'draft', ...scope, lineItems: [] };
  await savePhysicalInventory(body);
  expect(client.put).toHaveBeenCalledWith('/physicalInventories/draft', body);
  await deletePhysicalInventory('draft');
  expect(client.delete).toHaveBeenCalledWith('/physicalInventories/draft');
  const event = { resourceId: 'draft', ...scope, signature: '', lineItems: [] };
  await submitPhysicalInventory(event);
  expect(client.post).toHaveBeenCalledWith('/stockEvents', event);
  const lot = { lotCode: 'NEW', expirationDate: null, tradeItemId: 't', active: true as const };
  expect(await createPhysicalInventoryLot(lot)).toEqual({ id: 'created' });
  expect(client.post).toHaveBeenCalledWith('/lots', lot);
});

it('prints through a blob request without a token in the URL', async () => {
  const report = new Blob(['pdf'], { type: 'application/pdf' });
  vi.mocked(client.get).mockResolvedValue({ data: report });
  expect(await fetchPhysicalInventoryReport('draft', true, 'ar')).toBe(report);
  expect(client.get).toHaveBeenCalledWith('/physicalInventories/draft', {
    params: { format: 'pdf', showInDoses: true, lang: 'ar' },
    responseType: 'blob',
  });
});
