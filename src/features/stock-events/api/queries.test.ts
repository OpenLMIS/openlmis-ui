import { onlineManager, QueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchOrderablesByIds, fetchTradeItemByGtin } from '@/features/reference-data/api/api';
import { fetchEventStockCards } from '@/features/stock-events/api/api';
import {
  eventStockCardsOptions,
  fetchHomeStockTradeItem,
  fetchReceiveTradeItem,
  receiveApprovedProductsOptions,
  receiveCatalogOptions,
  receiveDevice,
  receiveOrderablesOptions,
} from '@/features/stock-events/api/queries';
import {
  getHomeStockBundle,
  type HomeStockBundle,
  readHomeStockBundle,
} from '@/features/stock-events/lib/home-stock-bundle';
import { kitCards } from '@/features/stock-events/lib/products';
import { readReceiveCatalog } from '@/features/stock-events/lib/receive-catalog';
import type { ReceiveCatalogView } from '@/features/stock-events/lib/receive-catalog-view';
import { catalogScanProduct } from '@/features/stock-events/lib/scan-products';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import { LocalDataUnavailableError, onlineOrDevice } from '@/lib/local-data';

vi.mock('@/features/reference-data/api/api', () => ({
  fetchTradeItemByGtin: vi.fn(),
  fetchOrderablesByIds: vi.fn(),
  fetchApprovedProducts: vi.fn(),
}));
vi.mock('@/features/stock-events/lib/receive-catalog', () => ({ readReceiveCatalog: vi.fn() }));
vi.mock('@/features/stock-events/api/api', () => ({ fetchEventStockCards: vi.fn() }));
vi.mock('@/features/stock-events/lib/home-stock-bundle', () => ({
  getHomeStockBundle: vi.fn(),
  readHomeStockBundle: vi.fn(),
}));
const filter = { facilityId: 'home', programId: 'program' };
const scope = { ...filter, facilityTypeId: 'type', scanning: true };
const saved: HomeStockBundle = {
  ...scope,
  userId: 'user',
  generation: 'generation',
  fetchedAt: 1,
  formatVersion: 4,
  cards: [],
  reasons: [],
  tradeItems: [],
  identities: [],
};
const kit: EventStockCard = {
  id: 'kit-card',
  stockOnHand: 3,
  lot: null,
  orderable: {
    id: 'kit',
    productCode: 'KIT',
    fullProductName: 'Kit',
    netContent: 1,
    children: [{ orderable: { id: 'child' }, quantity: 1 }],
  },
};
const queryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000, networkMode: 'always' } },
  });
beforeEach(() => vi.resetAllMocks());

it('still lists Unpack kits after Adjustments caches stripped products for the same program', async () => {
  const client = queryClient();
  vi.mocked(getHomeStockBundle).mockResolvedValue({
    ...saved,
    cards: [
      {
        ...kit,
        id: 'kit-card',
        active: true,
        occurredDate: null,
        orderable: { ...kit.orderable, description: null, children: undefined },
      },
    ],
  });
  vi.mocked(fetchEventStockCards).mockResolvedValue([kit]);
  await client.fetchQuery(eventStockCardsOptions(filter, scope));
  const unpack = await client.fetchQuery(eventStockCardsOptions(filter));
  expect(kitCards(unpack.cards)).toEqual([kit]);
  expect(fetchEventStockCards).toHaveBeenCalledTimes(1);
});

it('uses only the normal online GTIN query and retains its cache and unregistered result', async () => {
  const client = queryClient();
  vi.mocked(fetchTradeItemByGtin).mockResolvedValue({ id: 'not-stocked' });
  await expect(fetchHomeStockTradeItem(client, scope, '123')).resolves.toEqual({
    tradeItem: { id: 'not-stocked' },
    offline: false,
  });
  await fetchHomeStockTradeItem(client, scope, '123');
  vi.mocked(fetchTradeItemByGtin).mockResolvedValue(null);
  await expect(fetchHomeStockTradeItem(client, scope, '456')).resolves.toEqual({
    tradeItem: null,
    offline: false,
  });
  expect(fetchTradeItemByGtin).toHaveBeenCalledTimes(2);
  expect(getHomeStockBundle).not.toHaveBeenCalled();
  expect(readHomeStockBundle).not.toHaveBeenCalled();
});

it.each([AxiosError.ERR_NETWORK, AxiosError.ECONNABORTED])(
  'uses saved GTIN mappings after %s and distinguishes a missing stock mapping from absent local data',
  async (code) => {
    vi.mocked(fetchTradeItemByGtin).mockRejectedValue(new AxiosError('Unavailable', code));
    vi.mocked(readHomeStockBundle).mockResolvedValue({
      ...saved,
      scanning: true,
      tradeItems: [{ id: 'stocked', gtin: '123' }],
    });
    const client = queryClient();
    await expect(fetchHomeStockTradeItem(client, scope, '123')).resolves.toEqual({
      tradeItem: { id: 'stocked', gtin: '123' },
      offline: true,
    });
    await expect(fetchHomeStockTradeItem(client, scope, '456')).resolves.toEqual({
      tradeItem: null,
      offline: true,
    });
    vi.mocked(readHomeStockBundle).mockRejectedValue(new LocalDataUnavailableError());
    await expect(fetchHomeStockTradeItem(client, scope, '789')).rejects.toBeInstanceOf(
      LocalDataUnavailableError,
    );
  },
);

it('never substitutes device GTINs for a definitive service refusal', async () => {
  const refusal = Object.assign(new AxiosError('Refused'), { response: { status: 403, data: {} } });
  vi.mocked(fetchTradeItemByGtin).mockRejectedValue(refusal);
  await expect(fetchHomeStockTradeItem(queryClient(), scope, '123')).rejects.toBe(refusal);
  expect(readHomeStockBundle).not.toHaveBeenCalled();
});

it('does not send offline GTIN requests and requires a scan-enabled saved bundle', async () => {
  onlineManager.setOnline(false);
  vi.mocked(readHomeStockBundle).mockResolvedValue({
    ...saved,
    scanning: false,
    tradeItems: [],
  });
  await expect(fetchHomeStockTradeItem(queryClient(), scope, '123')).rejects.toBeInstanceOf(
    LocalDataUnavailableError,
  );
  expect(fetchTradeItemByGtin).not.toHaveBeenCalled();
});

it('carries snapshot metadata only for cards actually read from the device', async () => {
  const client = queryClient();
  onlineManager.setOnline(false);
  const device = await onlineOrDevice(
    async () => saved,
    async () => ({ ...saved }),
  );
  vi.mocked(getHomeStockBundle).mockResolvedValue(device);
  const options = eventStockCardsOptions(filter, scope);
  await expect(client.fetchQuery(options)).resolves.toEqual({
    cards: saved.cards,
    device: { fetchedAt: saved.fetchedAt, generation: saved.generation },
  });
  onlineManager.setOnline(true);
  vi.mocked(getHomeStockBundle).mockResolvedValue({ ...saved });
  await client.invalidateQueries({ queryKey: options.queryKey });
  await expect(client.fetchQuery(options)).resolves.toEqual({
    cards: saved.cards,
    device: undefined,
  });
});

it('reads and scans the Receive catalog offline without consuming a warm server page', async () => {
  onlineManager.setOnline(false);
  const client = queryClient();
  const device = receiveDevice(filter, 'type', false);
  vi.mocked(readHomeStockBundle).mockResolvedValue({
    ...saved,
    formatVersion: 6,
    summaries: [],
    products: [],
  });
  const orderable = {
    id: 'approved',
    productCode: 'APP',
    fullProductName: 'Approved',
    description: null,
    identifiers: { tradeItem: 'trade' },
  };
  vi.mocked(readReceiveCatalog).mockResolvedValue({
    ...filter,
    facilityTypeId: 'type',
    userId: 'user',
    generation: 'catalog',
    fetchedAt: 1,
    formatVersion: 1,
    scanning: true,
    approved: [{ id: 'approved', versionNumber: null }],
    products: [orderable],
    fulfils: {},
    lots: [],
    tradeItems: [{ id: 'trade', gtin: '123' }],
  });
  const server = receiveApprovedProductsOptions(
    client,
    filter,
    '',
    0,
    receiveDevice(filter, 'type', true),
  );
  client.setQueryData(server.queryKey, {
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 100,
  });
  expect(
    (await client.fetchQuery(receiveApprovedProductsOptions(client, filter, '', 0, device)))
      .content,
  ).toEqual([{ id: 'approved', orderable }]);
  await expect(fetchReceiveTradeItem(client, device, '123')).resolves.toEqual({
    tradeItem: { id: 'trade', gtin: '123' },
    offline: true,
  });
  await expect(catalogScanProduct(client, device, 'TRADE')).resolves.toMatchObject({
    type: 'found',
    product: { orderable, cards: [{ stockOnHand: null }] },
    productHasLots: false,
  });
  await expect(catalogScanProduct(client, device, 'absent')).resolves.toEqual({
    type: 'refuse',
    reason: 'productNotInProgram',
  });
  expect(fetchTradeItemByGtin).not.toHaveBeenCalled();
  expect(readReceiveCatalog).toHaveBeenCalledTimes(1);
  client.setQueryData(receiveCatalogOptions(device).queryKey, {
    ...(await client.fetchQuery(receiveCatalogOptions(device))),
    scanning: false,
  });
  await expect(fetchReceiveTradeItem(client, device, '123')).rejects.toBeInstanceOf(
    LocalDataUnavailableError,
  );
});

it.each([false, true])(
  'keeps device product versions scoped to each Receive catalog with online=%s',
  async (online) => {
    onlineManager.setOnline(online);
    vi.mocked(fetchOrderablesByIds).mockRejectedValue(
      new AxiosError('Unavailable', AxiosError.ERR_NETWORK),
    );
    const client = queryClient();
    const a = receiveDevice(filter, 'type', online);
    const b = receiveDevice({ ...filter, programId: 'other' }, 'type', online);
    const view = (versionNumber: number): ReceiveCatalogView => ({
      fetchedAt: 1,
      generation: 'catalog',
      scanning: true,
      approved: [],
      fulfils: {},
      fulfilledBy: new Map<string, string[]>(),
      lots: new Map(),
      tradeItems: [],
      stock: new Map(),
      products: new Map([
        [
          'same',
          {
            id: 'same',
            productCode: 'SAME',
            fullProductName: 'Same',
            description: null,
            meta: { versionNumber },
          },
        ],
      ]),
    });
    client.setQueryData(receiveCatalogOptions(a).queryKey, view(1));
    client.setQueryData(receiveCatalogOptions(b).queryKey, view(2));
    expect(
      (await client.fetchQuery(receiveOrderablesOptions(client, ['same'], a)))[0].meta
        ?.versionNumber,
    ).toBe(1);
    expect(
      (await client.fetchQuery(receiveOrderablesOptions(client, ['same'], b)))[0].meta
        ?.versionNumber,
    ).toBe(2);
  },
);
