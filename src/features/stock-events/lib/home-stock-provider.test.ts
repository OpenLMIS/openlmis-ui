import { expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import type { HomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import {
  HOME_STOCK_ACCEPTANCE,
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
  formatVersion: 6,
  destinations: [],
  sources: [],
  scanning: true,
  summaries: [],
  products: [],
  cards: [],
  reasons: [],
  tradeItems: [],
  identities: [],
};

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

it.each([4, 5, 6] as const)(
  'checks format %s against each consumer and provider freshness',
  async (formatVersion) => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'owner', username: 'owner', accessToken: 'token' });
    try {
      const record = { ...bundle, formatVersion };
      await localTable(LOCAL_TABLES.offlineAccess).put(access);
      await localTable(LOCAL_TABLES.homeStockDownloads).put(record);
      const provider = homeStockProvider(async () => record);
      const [scope] = provider.tasks(access);
      for (const minimum of [4, 5, 6] as const) {
        expect(await provider.readScopeState(scope, HOME_STOCK_ACCEPTANCE[minimum])).toBe(
          formatVersion >= minimum ? 'ready' : 'outdated',
        );
      }
      expect(scope.isFresh(record)).toBe(formatVersion === 6);
      if (formatVersion === 6)
        await expect(scope.fetch(new AbortController().signal)).resolves.toBe(record);
      else
        await expect(scope.fetch(new AbortController().signal)).rejects.toThrow('scope mismatch');
    } finally {
      await localTable(LOCAL_TABLES.homeStockDownloads).clear();
      await localTable(LOCAL_TABLES.offlineAccess).clear();
      useLoginData.getState().clearLoginData();
    }
  },
);
