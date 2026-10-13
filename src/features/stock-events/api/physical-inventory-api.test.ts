import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFacilityOrderableFulfills,
  fetchLotsByIds,
  fetchLotsByTradeItems,
  fetchOrderablesByIdentities,
  fetchOrderablesByIds,
} from '@/features/reference-data/api/api';
import { orderablesByIdentitiesOptions } from '@/features/reference-data/api/queries';
import {
  createPhysicalInventoryLot,
  deletePhysicalInventory,
  fetchEligibleInventoryProducts,
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
  fetchOrderablesByIdentities: vi.fn().mockResolvedValue([]),
  fetchFacilityOrderableFulfills: vi.fn(),
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

it('starts known product reads with fulfills and fetches only extra fulfill ids', async () => {
  const fulfills =
    Promise.withResolvers<Awaited<ReturnType<typeof fetchFacilityOrderableFulfills>>>();
  const known = Promise.withResolvers<Awaited<ReturnType<typeof fetchOrderablesByIds>>>();
  const product = (id: string) => ({
    id,
    productCode: id,
    fullProductName: id,
    description: null,
    identifiers: { tradeItem: `trade-${id}` },
  });
  vi.mocked(fetchFacilityOrderableFulfills).mockReturnValueOnce(fulfills.promise);
  vi.mocked(fetchOrderablesByIds)
    .mockReturnValueOnce(known.promise)
    .mockResolvedValueOnce([product('extra')]);
  vi.mocked(fetchLotsByTradeItems).mockResolvedValue([]);
  const result = fetchEligibleInventoryProducts({ facilityId: 'f', programId: 'p' }, [
    {
      orderable: { id: 'approved' },
      canFulfillForMe: [{ orderable: { id: 'card' }, lot: null, stockOnHand: 0 }],
    },
  ]);
  expect(fetchFacilityOrderableFulfills).toHaveBeenCalledExactlyOnceWith({
    facilityId: 'f',
    programId: 'p',
  });
  expect(fetchOrderablesByIds).toHaveBeenCalledWith(['approved', 'card']);
  fulfills.resolve({
    approved: { canFulfillForMe: ['extra', 'card'] },
    unlisted: { canFulfillForMe: ['ignored'] },
  });
  known.resolve([product('approved'), product('card')]);
  expect((await result).map((line) => line.orderable.id)).toEqual(['card', 'extra', 'approved']);
  expect(fetchOrderablesByIds).toHaveBeenNthCalledWith(2, ['extra']);
  expect(fetchOrderablesByIds).toHaveBeenCalledTimes(2);
  expect(fetchLotsByTradeItems).toHaveBeenCalledWith([
    'trade-approved',
    'trade-extra',
    'trade-card',
  ]);
});

it('hydrates the versions from summaries without falling back to the latest-version id lookup', async () => {
  const product = { id: 'o', productCode: 'O', fullProductName: 'Product', description: null };
  vi.mocked(fetchOrderablesByIdentities).mockResolvedValueOnce([product]);
  vi.mocked(fetchOrderablesByIds).mockResolvedValueOnce([]);
  vi.mocked(fetchLotsByIds).mockResolvedValueOnce([]);
  const result = await fetchInventoryStockLines(
    [],
    [
      {
        orderable: { id: 'o', versionNumber: 12 },
        canFulfillForMe: [{ orderable: { id: 'o', versionNumber: 12 }, stockOnHand: 5 }],
      },
    ],
  );
  expect(result[0].orderable).toEqual(product);
  expect(fetchOrderablesByIdentities).toHaveBeenCalledWith([
    { id: 'o', versionNumber: 12 },
    { id: 'o', versionNumber: 12 },
  ]);
  expect(fetchOrderablesByIds).toHaveBeenCalledWith([]);
});

it('shares all summary identities for stock hydration and eligibility including stockless products', async () => {
  const summaries = [
    {
      orderable: { id: 'stocked', versionNumber: 12 },
      canFulfillForMe: [{ orderable: { id: 'stocked', versionNumber: 12 }, stockOnHand: 5 }],
    },
    { orderable: { id: 'stockless', versionNumber: 3 }, canFulfillForMe: [] },
  ];
  const products = ['stocked', 'stockless'].map((id) => ({
    id,
    productCode: id,
    fullProductName: id,
    description: null,
  }));
  vi.mocked(fetchOrderablesByIdentities).mockResolvedValue(products);
  vi.mocked(fetchOrderablesByIds).mockResolvedValue([]);
  vi.mocked(fetchLotsByIds).mockResolvedValue([]);
  vi.mocked(fetchLotsByTradeItems).mockResolvedValue([]);
  vi.mocked(fetchFacilityOrderableFulfills).mockResolvedValue({});
  const queryClient = new QueryClient();
  const lookup: typeof fetchOrderablesByIdentities = (identities) =>
    queryClient.fetchQuery(orderablesByIdentitiesOptions(identities));
  await Promise.all([
    fetchInventoryStockLines([], summaries, lookup),
    fetchEligibleInventoryProducts({ facilityId: 'f', programId: 'p' }, summaries, lookup),
  ]);
  expect(fetchOrderablesByIdentities).toHaveBeenCalledExactlyOnceWith([
    { id: 'stocked', versionNumber: 12 },
    { id: 'stockless', versionNumber: 3 },
  ]);
  queryClient.clear();
});

it('skips the scope fulfills request without approved products, which would read every product', async () => {
  vi.mocked(fetchOrderablesByIds).mockResolvedValue([]);
  vi.mocked(fetchLotsByTradeItems).mockResolvedValue([]);
  expect(await fetchEligibleInventoryProducts({ facilityId: 'f', programId: 'p' }, [])).toEqual([]);
  expect(fetchFacilityOrderableFulfills).not.toHaveBeenCalled();
});
