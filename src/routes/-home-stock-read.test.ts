import { beforeEach, expect, it, vi } from 'vitest';
import { readStockCardHistory } from '@/features/stock-card/lib/history-cache';
import { readHomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { readOfflineAccess } from '@/lib/offline-access';
import { readStockCardOnDevice, readStockOnHandOnDevice } from '@/routes/-home-stock-read';
import { offlineAccessFixture } from '@/test-utils/offline-access';

vi.mock('@/features/stock-card/lib/history-cache', () => ({
  readStockCardHistory: vi.fn(async () => undefined),
}));
vi.mock('@/lib/offline-access', () => ({ readOfflineAccess: vi.fn() }));
vi.mock('@/features/stock-events/lib/home-stock-bundle', () => ({
  readHomeStockBundle: vi.fn(),
  fetchHomeStockBundle: vi.fn(),
}));
const access = offlineAccessFixture({ userId: 'u' });
const product = { id: 'o', productCode: 'ABC', fullProductName: 'Medicine', description: null };
const bundle = {
  userId: 'u',
  facilityId: 'home',
  programId: 'p',
  facilityTypeId: 'type',
  generation: 'g',
  formatVersion: 5,
  fetchedAt: 100,
  products: [product],
  cards: [
    {
      id: 'c',
      orderable: product,
      lot: { id: 'lot', lotCode: 'L1' },
      stockOnHand: 7,
      active: false,
      occurredDate: '2026-01-01',
    },
  ],
  summaries: [
    {
      orderable: { id: 'o' },
      stockOnHand: 7,
      canFulfillForMe: [
        {
          stockCard: { id: 'c' },
          orderable: { id: 'o' },
          lot: { id: 'lot' },
          stockOnHand: 7,
          active: false,
          occurredDate: '2026-01-01',
        },
      ],
    },
  ],
};
const query = {
  facilityId: 'home',
  programId: 'p',
  nonEmptyOnly: true,
  page: 0,
  size: 10,
} as const;
beforeEach(() => {
  vi.mocked(readStockCardHistory).mockResolvedValue(undefined);
  vi.mocked(readOfflineAccess).mockResolvedValue(access as never);
  vi.mocked(readHomeStockBundle).mockResolvedValue(bundle as never);
});

it('shows a downloaded Stock Card summary without inventing transaction history', async () => {
  expect(await readStockCardOnDevice('c')).toMatchObject({
    facility: { id: 'home' },
    program: { id: 'p' },
    orderable: product,
    stockOnHand: 7,
    active: false,
    lineItems: [],
    summaryOnly: true,
    device: { fetchedAt: 100, generation: 'g' },
  });
  await expect(readStockCardOnDevice('missing')).rejects.toBeInstanceOf(LocalDataUnavailableError);
});
it('rejects other facilities, undownloaded programs and programs without the required rights', async () => {
  await expect(readStockOnHandOnDevice({ ...query, facilityId: 'other' })).rejects.toBeInstanceOf(
    LocalDataUnavailableError,
  );
  await expect(readStockOnHandOnDevice({ ...query, programId: 'other' })).rejects.toBeInstanceOf(
    LocalDataUnavailableError,
  );
  vi.mocked(readOfflineAccess).mockResolvedValue({
    ...access,
    permissionStrings: ['STOCK_ADJUST|home|p'],
  } as never);
  await expect(readStockOnHandOnDevice(query)).rejects.toBeInstanceOf(LocalDataUnavailableError);
  await expect(readStockCardOnDevice('c')).rejects.toBeInstanceOf(LocalDataUnavailableError);
});
it('keeps missing downloads unavailable rather than returning an empty stock list', async () => {
  vi.mocked(readHomeStockBundle).mockRejectedValue(new LocalDataUnavailableError());
  await expect(readStockOnHandOnDevice(query)).rejects.toBeInstanceOf(LocalDataUnavailableError);
});

it('requires a new download for a v4 bundle without stock summary groups', async () => {
  vi.mocked(readHomeStockBundle).mockResolvedValue({
    ...bundle,
    formatVersion: 4,
    summaries: undefined,
    products: undefined,
  } as never);
  await expect(readStockOnHandOnDevice(query)).rejects.toBeInstanceOf(LocalDataUnavailableError);
  expect(await readStockCardOnDevice('c')).toMatchObject({ summaryOnly: true, stockOnHand: 7 });
});

it('keeps cached history restricted to eligible home programs after access changes', async () => {
  const history = {
    id: 'c',
    facility: { id: 'home' },
    program: { id: 'p' },
    lineItems: [{ id: 'line' }],
  };
  vi.mocked(readStockCardHistory).mockResolvedValue(history as never);
  vi.mocked(readHomeStockBundle).mockRejectedValue(new LocalDataUnavailableError());
  expect(await readStockCardOnDevice('c')).toBe(history);
  vi.mocked(readStockCardHistory).mockResolvedValue({
    ...history,
    facility: { id: 'other' },
  } as never);
  await expect(readStockCardOnDevice('c')).rejects.toBeInstanceOf(LocalDataUnavailableError);
  vi.mocked(readStockCardHistory).mockResolvedValue(history as never);
  vi.mocked(readOfflineAccess).mockResolvedValue({ ...access, permissionStrings: [] } as never);
  await expect(readStockCardOnDevice('c')).rejects.toBeInstanceOf(LocalDataUnavailableError);
});

it('serves view-only home stock and histories without adjustment rights', async () => {
  vi.mocked(readOfflineAccess).mockResolvedValue({
    ...access,
    permissionStrings: ['STOCK_CARDS_VIEW|home|p'],
  } as never);
  expect((await readStockOnHandOnDevice(query)).content).toEqual(bundle.summaries);
  expect(await readStockCardOnDevice('c')).toMatchObject({ id: 'c' });
});
