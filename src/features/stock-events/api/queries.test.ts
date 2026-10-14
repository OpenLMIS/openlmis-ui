import { onlineManager, QueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchTradeItemByGtin } from '@/features/reference-data/api/api';
import { fetchEventStockCards } from '@/features/stock-events/api/api';
import {
  eventStockCardsOptions,
  fetchAdjustmentTradeItem,
} from '@/features/stock-events/api/queries';
import { kitCards } from '@/features/stock-events/lib/products';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import {
  type AdjustmentBundle,
  getAdjustmentBundle,
  readAdjustmentBundle,
} from '@/lib/adjustment-bundle';
import { LocalDataUnavailableError } from '@/lib/local-data';

vi.mock('@/features/reference-data/api/api', () => ({ fetchTradeItemByGtin: vi.fn() }));
vi.mock('@/features/stock-events/api/api', () => ({ fetchEventStockCards: vi.fn() }));
vi.mock('@/lib/adjustment-bundle', () => ({
  getAdjustmentBundle: vi.fn(),
  readAdjustmentBundle: vi.fn(),
}));
const filter = { facilityId: 'home', programId: 'program' };
const scope = { ...filter, facilityTypeId: 'type', scanning: true };
const saved: AdjustmentBundle = {
  ...scope,
  userId: 'user',
  generation: 'generation',
  fetchedAt: 1,
  formatVersion: 1,
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
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
beforeEach(() => vi.resetAllMocks());

it('still lists Unpack kits after Adjustments caches stripped products for the same program', async () => {
  const client = queryClient();
  vi.mocked(getAdjustmentBundle).mockResolvedValue({
    ...saved,
    cards: [
      {
        ...kit,
        id: 'kit-card',
        orderable: { ...kit.orderable, description: null, children: undefined },
      },
    ],
  });
  vi.mocked(fetchEventStockCards).mockResolvedValue([kit]);
  await client.fetchQuery(eventStockCardsOptions(filter, scope));
  const unpack = await client.fetchQuery(eventStockCardsOptions(filter));
  expect(kitCards(unpack)).toEqual([kit]);
  expect(fetchEventStockCards).toHaveBeenCalledTimes(1);
});

it('uses only the normal online GTIN query and retains its cache and unregistered result', async () => {
  const client = queryClient();
  vi.mocked(fetchTradeItemByGtin).mockResolvedValue({ id: 'not-stocked' });
  await expect(fetchAdjustmentTradeItem(client, scope, '123')).resolves.toEqual({
    tradeItem: { id: 'not-stocked' },
    offline: false,
  });
  await fetchAdjustmentTradeItem(client, scope, '123');
  vi.mocked(fetchTradeItemByGtin).mockResolvedValue(null);
  await expect(fetchAdjustmentTradeItem(client, scope, '456')).resolves.toEqual({
    tradeItem: null,
    offline: false,
  });
  expect(fetchTradeItemByGtin).toHaveBeenCalledTimes(2);
  expect(getAdjustmentBundle).not.toHaveBeenCalled();
  expect(readAdjustmentBundle).not.toHaveBeenCalled();
});

it.each([AxiosError.ERR_NETWORK, AxiosError.ECONNABORTED])(
  'uses saved GTIN mappings after %s and distinguishes a missing stock mapping from absent local data',
  async (code) => {
    vi.mocked(fetchTradeItemByGtin).mockRejectedValue(new AxiosError('Unavailable', code));
    vi.mocked(readAdjustmentBundle).mockResolvedValue({
      ...saved,
      scanning: true,
      tradeItems: [{ id: 'stocked', gtin: '123' }],
    });
    const client = queryClient();
    await expect(fetchAdjustmentTradeItem(client, scope, '123')).resolves.toEqual({
      tradeItem: { id: 'stocked', gtin: '123' },
      offline: true,
    });
    await expect(fetchAdjustmentTradeItem(client, scope, '456')).resolves.toEqual({
      tradeItem: null,
      offline: true,
    });
    vi.mocked(readAdjustmentBundle).mockRejectedValue(new LocalDataUnavailableError());
    await expect(fetchAdjustmentTradeItem(client, scope, '789')).rejects.toBeInstanceOf(
      LocalDataUnavailableError,
    );
  },
);

it('never substitutes device GTINs for a definitive service refusal', async () => {
  const refusal = Object.assign(new AxiosError('Refused'), { response: { status: 403, data: {} } });
  vi.mocked(fetchTradeItemByGtin).mockRejectedValue(refusal);
  await expect(fetchAdjustmentTradeItem(queryClient(), scope, '123')).rejects.toBe(refusal);
  expect(readAdjustmentBundle).not.toHaveBeenCalled();
});

it('does not send offline GTIN requests and requires a scan-enabled saved bundle', async () => {
  onlineManager.setOnline(false);
  vi.mocked(readAdjustmentBundle).mockResolvedValue({
    ...saved,
    scanning: false,
    tradeItems: [],
  });
  await expect(fetchAdjustmentTradeItem(queryClient(), scope, '123')).rejects.toBeInstanceOf(
    LocalDataUnavailableError,
  );
  expect(fetchTradeItemByGtin).not.toHaveBeenCalled();
});
