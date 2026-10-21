import { expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import type { HomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import {
  acceptsAdjustmentBundle,
  acceptsStockOnHandBundle,
  homeStockProvider,
} from '@/features/stock-events/lib/home-stock-provider';
import { LOCAL_TABLES, localTable } from '@/integrations/local-db';
import { offlineAccessFixture } from '@/tests/offline-access';

const program = { id: 'p', code: 'P', name: 'Program', active: true };
const access = { ...offlineAccessFixture({ programs: [program] }), fetchedAt: 1 };
const home = access.homeFacility;
if (!home) throw new Error('Missing fixture home');
const bundle: HomeStockBundle = {
  userId: 'owner',
  facilityId: 'home',
  programId: 'p',
  facilityTypeId: 'type',
  fetchedAt: Date.now(),
  generation: 'stock',
  formatVersion: 5,
  scanning: true,
  summaries: [],
  products: [],
  cards: [],
  reasons: [],
  tradeItems: [],
  identities: [],
};

it('refreshes and rejects v4 data without summaries/products but accepts complete v5 data', async () => {
  const older: HomeStockBundle = {
    ...bundle,
    formatVersion: 4,
    summaries: undefined,
    products: undefined,
  };
  const [oldTask] = homeStockProvider(async () => older).tasks(access);
  expect(oldTask.isFresh(older)).toBe(false);
  await expect(oldTask.fetch(new AbortController().signal)).rejects.toThrow('scope mismatch');
  const [task] = homeStockProvider(async () => bundle).tasks(access);
  expect(task.isFresh(bundle)).toBe(true);
  expect(await task.fetch(new AbortController().signal)).toBe(bundle);
});

it('downloads both adjustment and view-only programs, excluding unsupported and supervised scopes', () => {
  const second = { ...program, id: 'b', code: 'B' };
  const tasks = homeStockProvider().tasks({
    ...access,
    programs: [
      program,
      second,
      { ...program, id: 'unsupported' },
      { ...program, id: 'supervised' },
    ],
    homeFacility: {
      ...home,
      supportedPrograms: [program, second].map((item) => ({
        ...item,
        supportActive: true,
        supportLocallyFulfilled: true,
      })),
    },
    permissionStrings: [
      'STOCK_ADJUST|home|p',
      'STOCK_CARDS_VIEW|home|p',
      'STOCK_CARDS_VIEW|home|b',
      'STOCK_CARDS_VIEW|home|unsupported',
      'STOCK_CARDS_VIEW|other|supervised',
    ],
  });
  expect(tasks.map((task) => task.id).sort()).toEqual(['b', 'p']);
});

it('keeps Adjustments enabled for a format 4 download while Stock On Hand needs format 5', async () => {
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'owner',
    username: 'owner',
    accessToken: 'token',
  });
  try {
    await localTable(LOCAL_TABLES.offlineAccess).put(access);
    await localTable(LOCAL_TABLES.homeStockDownloads).put({
      ...bundle,
      formatVersion: 4,
      summaries: undefined,
      products: undefined,
    });
    const provider = homeStockProvider();
    const [scope] = provider.tasks(access);
    expect(await provider.readScope(scope, acceptsAdjustmentBundle)).toBe(true);
    expect(await provider.readScope(scope, acceptsStockOnHandBundle)).toBe(false);
  } finally {
    await localTable(LOCAL_TABLES.homeStockDownloads).clear();
    await localTable(LOCAL_TABLES.offlineAccess).clear();
    useLoginData.getState().clearLoginData();
  }
});
