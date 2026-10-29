import { expect, it, vi } from 'vitest';
import type { ReceiveCatalog } from '@/features/stock-events/lib/receive-catalog';
import {
  receiveCatalogProvider,
  receiveCatalogScopes,
} from '@/features/stock-events/lib/receive-catalog-provider';
import { offlineAccessFixture } from '@/test-utils/offline-access';

vi.mock('@/lib/feature-flags', () => ({ getFlag: () => true }));

const access = offlineAccessFixture({ rights: ['STOCK_ADJUST|home|p', 'STOCK_CARDS_VIEW|home|p'] });
const record: ReceiveCatalog = {
  userId: 'owner',
  facilityId: 'home',
  programId: 'p',
  facilityTypeId: 'type',
  generation: 'catalog',
  fetchedAt: Date.now() - 2 * 60 * 60_000,
  formatVersion: 1,
  scanning: true,
  approved: [],
  products: [],
  fulfils: {},
  lots: [],
  tradeItems: [],
};

it('requires both home stock eligibility and the Receive grant and carries the program code', () => {
  expect(receiveCatalogScopes(access)).toMatchObject([
    { programCode: 'P', refreshKey: 'receive-catalog:home:p' },
  ]);
  for (const rights of [
    ['STOCK_ADJUST|home|p'],
    ['STOCK_CARDS_VIEW|home|p'],
    ['STOCK_ADJUST|other|p', 'STOCK_CARDS_VIEW|home|p'],
  ])
    expect(receiveCatalogScopes({ ...access, permissionStrings: rights })).toEqual([]);
  expect(
    receiveCatalogScopes({ ...access, programs: [{ ...access.programs[0], code: '' }] }),
  ).toEqual([]);
});

it('reuses complete catalogs regardless of age and rejects incompatible downloads', () => {
  const provider = receiveCatalogProvider();
  const [task] = provider.tasks(access);
  expect(provider.refreshOn).toEqual(['sign-in']);
  expect(task.isFresh(record)).toBe(true);
  for (const change of [
    { userId: 'other' },
    { formatVersion: 2 },
    { products: undefined },
    { stale: true },
    { fulfils: null },
  ])
    expect(task.isFresh({ ...record, ...change } as ReceiveCatalog)).toBe(false);
  const withoutScanning = { ...record, scanning: false };
  expect(task.isFresh(withoutScanning)).toBe(false);
});
