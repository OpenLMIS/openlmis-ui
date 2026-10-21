import { beforeEach, expect, it, vi } from 'vitest';
import { readStockCardHistory } from '@/features/stock-card/lib/history-cache';
import { readHomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { readOfflineAccess } from '@/lib/offline-access';
import { readStockCardOnDevice, readStockOnHandOnDevice } from '@/routes/-home-stock-read';

vi.mock('@/features/stock-card/lib/history-cache', () => ({
  readStockCardHistory: vi.fn(async () => undefined),
}));
vi.mock('@/lib/offline-access', () => ({ readOfflineAccess: vi.fn() }));
vi.mock('@/features/stock-events/lib/home-stock-bundle', () => ({
  readHomeStockBundle: vi.fn(),
  fetchHomeStockBundle: vi.fn(),
}));
const access = {
  userId: 'u',
  permissionStrings: ['STOCK_ADJUST|home|p', 'STOCK_CARDS_VIEW|home|p'],
  programs: [{ id: 'p', code: 'P', name: 'Program', active: true }],
  homeFacility: {
    id: 'home',
    code: 'H',
    name: 'Home',
    active: true,
    enabled: true,
    type: { id: 'type' },
    supportedPrograms: [{ id: 'p', supportActive: true, supportLocallyFulfilled: true }],
  },
};
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
it('filters and pages downloaded summaries with names, lots and inactive metadata intact', async () => {
  const page = await readStockOnHandOnDevice({ ...query, orderableName: 'med', lotCode: 'l1' });
  expect(page.content).toEqual(bundle.summaries);
  expect(page.device?.products).toEqual([product]);
  expect(page.device?.fetchedAt).toBe(100);
  expect(
    (await readStockOnHandOnDevice({ ...query, orderableCode: 'missing' })).totalElements,
  ).toBe(0);
  expect(
    (await readStockOnHandOnDevice({ ...query, orderableName: 'missing' })).totalElements,
  ).toBe(0);
  expect((await readStockOnHandOnDevice({ ...query, lotCode: 'missing' })).totalElements).toBe(0);
  expect((await readStockOnHandOnDevice({ ...query, page: 1, size: 1 })).content).toEqual([]);
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
    downloadedAt: 100,
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

it('uses the newest product version for filtering and displayed stock metadata regardless of order', async () => {
  const latest = {
    ...product,
    fullProductName: 'Latest Medicine',
    netContent: 20,
    meta: { versionNumber: 3 },
  };
  const older = {
    ...product,
    fullProductName: 'Older Name',
    netContent: 5,
    meta: { versionNumber: 1 },
  };
  for (const products of [
    [latest, older],
    [older, latest],
  ]) {
    vi.mocked(readHomeStockBundle).mockResolvedValue({ ...bundle, products } as never);
    const page = await readStockOnHandOnDevice({ ...query, orderableName: 'Latest' });
    expect(page.content).toEqual(bundle.summaries);
    expect(page.device?.products).toEqual([latest]);
    expect(
      (await readStockOnHandOnDevice({ ...query, orderableName: 'Older' })).totalElements,
    ).toBe(0);
  }
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

it.each([7, null])(
  'totals only matching lots, including unknown balances (%s)',
  async (balance) => {
    const entry = bundle.summaries[0].canFulfillForMe[0];
    vi.mocked(readHomeStockBundle).mockResolvedValue({
      ...bundle,
      summaries: [
        {
          ...bundle.summaries[0],
          stockOnHand: 99,
          canFulfillForMe: [
            { ...entry, stockOnHand: balance },
            { ...entry, lot: null, stockOnHand: 92 },
          ],
        },
      ],
    } as never);
    expect((await readStockOnHandOnDevice(query)).content[0].stockOnHand).toBe(99);
    const page = await readStockOnHandOnDevice({ ...query, lotCode: 'L1' });
    expect(page.content[0].stockOnHand).toBe(balance);
    expect(page.content[0].canFulfillForMe).toHaveLength(1);
  },
);
