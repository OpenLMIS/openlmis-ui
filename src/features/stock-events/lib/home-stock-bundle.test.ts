import { onlineManager } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchHomeStockBundle,
  getHomeStockBundle,
  readHomeStockBundle,
} from '@/features/stock-events/lib/home-stock-bundle';
import { homeStockProvider } from '@/features/stock-events/lib/home-stock-provider';
import { client } from '@/integrations/axios';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { LocalDataUnavailableError } from '@/lib/local-data';
import type { AccessReaders } from '@/lib/offline-access';
import { startOfflineCoordinator } from '@/lib/offline-coordinator';
import { getDownloadStatus } from '@/lib/offline-download-status';

const filter = { facilityId: 'home', programId: 'program', facilityTypeId: 'type', scanning: true };
const product = (versionNumber: number) => ({
  id: 'product',
  productCode: 'MED',
  fullProductName: `Version ${versionNumber}`,
  description: 'discard',
  netContent: 10,
  children: [{ orderable: { id: 'child' }, quantity: 2 }],
  programs: [{ programId: 'program', orderableDisplayCategoryId: 'category' }],
  identifiers: { tradeItem: 'trade', secret: 'discard' },
  dispensable: { displayUnit: 'tablet', secret: 'discard' },
  extraData: { useVVM: 'true', secret: 'discard' },
  meta: { versionNumber, secret: 'discard' },
});
const summary = (versionNumber: number) => ({
  orderable: { id: 'product', versionNumber },
  stockOnHand: versionNumber,
  canFulfillForMe: [
    {
      stockCard: { id: `card-${versionNumber}` },
      orderable: { id: 'product' },
      lot: { id: 'lot' },
      stockOnHand: versionNumber,
      active: true,
      occurredDate: '2026-01-01',
    },
  ],
});
let requests: string[];
const originalAdapter = client.defaults.adapter;
beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'bundle-user', username: 'user', accessToken: 'token' });
  await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).clear();
  requests = [];
  client.defaults.adapter = async (config) => {
    requests.push(`${config.url}:${config.params?.page ?? 0}`);
    let data: unknown;
    switch (config.url) {
      case '/v2/stockCardSummaries':
        data = { content: [summary(config.params.page + 1)], totalPages: 2 };
        break;
      case '/orderables/search':
        data = {
          content: [product((JSON.parse(config.data) as { page: number }).page + 1)],
          totalPages: 2,
        };
        break;
      case '/lots':
        data = {
          content: [
            {
              id: 'lot',
              lotCode: 'LOT',
              expirationDate: '2027-01-01',
              tradeItemId: 'trade',
              secret: 'discard',
            },
          ],
          totalPages: 1,
        };
        break;
      case '/tradeItems':
        data = {
          content:
            config.params.page === 0 ? [] : [{ id: 'trade', gtin: '123', secret: 'discard' }],
          totalPages: 2,
        };
        break;
      case '/validReasons':
        data = [
          {
            hidden: false,
            reason: {
              id: 'reason',
              name: 'Damaged',
              reasonType: 'DEBIT',
              reasonCategory: 'ADJUSTMENT',
              isFreeTextAllowed: true,
              tags: [],
              secret: 'discard',
            },
          },
        ];
        break;
      default:
        throw new Error(`Unexpected ${config.url}`);
    }
    return { data, status: 200, statusText: 'OK', config, headers: {} };
  };
});
afterEach(() => {
  useLoginData.getState().clearLoginData();
  client.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

it('coalesces foreground reads, retains both requested versions and every page, and never persists', async () => {
  const [first, second] = await Promise.all([
    getHomeStockBundle(filter),
    getHomeStockBundle(filter),
  ]);
  expect(first).toBe(second);
  expect(first.formatVersion).toBe(5);
  expect(first.summaries?.map((group) => group.canFulfillForMe[0].stockCard.id)).toEqual([
    'card-1',
    'card-2',
  ]);
  expect(first.products?.map((product) => product.meta?.versionNumber)).toEqual([1, 2]);
  expect(first.cards.map((card) => card.orderable.meta?.versionNumber)).toEqual([1, 2]);
  expect(requests.filter((path) => path.startsWith('/v2/'))).toHaveLength(2);
  expect(requests.filter((path) => path.startsWith('/orderables/search'))).toHaveLength(2);
  expect(JSON.stringify(first)).not.toContain('discard');
  expect(first.cards[0].orderable.children).toEqual([{ orderable: { id: 'child' }, quantity: 2 }]);
  expect(first.cards[0].orderable.programs).toEqual([
    { programId: 'program', orderableDisplayCategoryId: 'category' },
  ]);
  expect(first.tradeItems).toEqual([]);
  expect(requests.filter((path) => path.startsWith('/tradeItems'))).toHaveLength(0);
  expect(await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).count()).toBe(0);
});

it('rejects unresolved identities rather than publishing a partial bundle', async () => {
  const adapter = client.defaults.adapter;
  client.defaults.adapter = async (config) =>
    config.url === '/orderables/search'
      ? {
          data: { content: [product(2)], totalPages: 1 },
          status: 200,
          statusText: 'OK',
          config,
          headers: {},
        }
      : (adapter as import('axios').AxiosAdapter)(config);
  await expect(getHomeStockBundle(filter)).rejects.toThrow('product');
});

it('runs offline and rejects a missing bundle with local-unavailable instead of an empty list', async () => {
  onlineManager.setOnline(false);
  await expect(getHomeStockBundle(filter)).rejects.toBeInstanceOf(LocalDataUnavailableError);
  await expect(readHomeStockBundle(filter)).rejects.toBeInstanceOf(LocalDataUnavailableError);
  expect(requests).toEqual([]);
});

it('falls back on a timed-out read but never on service refusal or cancellation', async () => {
  const saved = await getHomeStockBundle(filter);
  await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).put(saved);
  client.defaults.adapter = async () => {
    throw new AxiosError('Timed out', AxiosError.ECONNABORTED);
  };
  await expect(getHomeStockBundle(filter)).resolves.toEqual(saved);
  const refusal = Object.assign(new AxiosError('Refused'), { response: { status: 403, data: {} } });
  client.defaults.adapter = async () => {
    throw refusal;
  };
  await expect(getHomeStockBundle(filter)).rejects.toBe(refusal);
  const canceled = new AxiosError('Canceled', AxiosError.ERR_CANCELED);
  client.defaults.adapter = async () => {
    throw canceled;
  };
  await expect(getHomeStockBundle(filter)).rejects.toBe(canceled);
});

it('bounds timed-out background reads without declaring the browser offline', async () => {
  const adapter = vi.fn(async () => {
    throw new AxiosError('Timed out', AxiosError.ECONNABORTED);
  });
  client.defaults.adapter = adapter;
  await expect(fetchHomeStockBundle(filter)).rejects.toMatchObject({
    code: AxiosError.ECONNABORTED,
  });
  expect(adapter).toHaveBeenCalledTimes(4);
  expect(onlineManager.isOnline()).toBe(true);
});

it('rejects saved stock and reasons for a different facility type during device fallback', async () => {
  const saved = await getHomeStockBundle(filter);
  await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).put(saved);
  onlineManager.setOnline(false);
  await expect(getHomeStockBundle(filter)).resolves.toEqual(saved);
  await expect(
    getHomeStockBundle({ ...filter, facilityTypeId: 'changed-type' }),
  ).rejects.toBeInstanceOf(LocalDataUnavailableError);
});

it('serves online editor reads without Web Locks and never persists them', async () => {
  vi.stubGlobal('navigator', {});
  try {
    expect((await getHomeStockBundle(filter)).cards).toHaveLength(2);
    expect(await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).count()).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('accepts a complete empty program without requesting unrelated products or lots', async () => {
  const adapter = client.defaults.adapter as import('axios').AxiosAdapter;
  client.defaults.adapter = async (config) =>
    config.url === '/v2/stockCardSummaries'
      ? { data: { content: [], totalPages: 1 }, status: 200, statusText: 'OK', headers: {}, config }
      : adapter(config);
  const saved = await getHomeStockBundle(filter);
  expect(saved.cards).toEqual([]);
  expect(saved.identities).toEqual([]);
  expect(saved.tradeItems).toEqual([]);
  expect(saved.reasons).toHaveLength(1);
  expect(requests).toEqual(['/validReasons:0']);
});

it.each(['axios', 'abort'] as const)(
  'restarts a foreground read after coordinator %s cancellation',
  async (cause) => {
    const adapter = client.defaults.adapter as import('axios').AxiosAdapter;
    let foregroundReads = 0;
    let started!: () => void;
    const downloading = new Promise<void>((resolve) => {
      started = resolve;
    });
    client.defaults.adapter = async (config) => {
      if (config.signal) {
        started();
        return new Promise((_resolve, reject) => {
          config.signal?.addEventListener?.('abort', () =>
            reject(
              cause === 'axios'
                ? new AxiosError('Canceled', AxiosError.ERR_CANCELED, config)
                : new DOMException('Aborted', 'AbortError'),
            ),
          );
        });
      }
      foregroundReads += 1;
      return adapter(config);
    };
    const controller = new AbortController();
    const background = fetchHomeStockBundle(filter, controller.signal);
    const rejected = expect(background).rejects.toThrow();
    await downloading;
    const foreground = getHomeStockBundle(filter);
    await Promise.resolve();
    expect(foregroundReads).toBe(0);
    controller.abort();
    await rejected;
    expect((await foreground).cards).toHaveLength(2);
    expect(foregroundReads).toBeGreaterThan(0);
    expect(requests.filter((path) => path.startsWith('/tradeItems'))).toHaveLength(0);
  },
);

it.each(['foreground', 'coordinator'] as const)(
  'waits for same-user renewal after a refused %s bundle request',
  async (source) => {
    const adapter = client.defaults.adapter as import('axios').AxiosAdapter;
    const refused = vi.fn();
    client.defaults.adapter = async (config) => {
      if (source === 'foreground') {
        expect(config.backgroundRead).not.toBe(true);
        expect(config.session).not.toBe(false);
      }
      if (config.headers.Authorization === 'Bearer token') {
        refused();
        throw new AxiosError('Expired', AxiosError.ERR_BAD_REQUEST, config, undefined, {
          data: {},
          status: 401,
          statusText: 'Unauthorized',
          config,
          headers: {},
        });
      }
      return adapter(config);
    };
    const background =
      source === 'coordinator'
        ? expect(fetchHomeStockBundle(filter)).rejects.toMatchObject({
            code: AxiosError.ERR_CANCELED,
          })
        : undefined;
    const result = getHomeStockBundle(filter);
    await waitFor(() => expect(useLoginData.getState().expired).toBe(true));
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'bundle-user',
      username: 'user',
      accessToken: 'renewed',
    });
    expect((await result).cards).toHaveLength(2);
    expect(refused).toHaveBeenCalledTimes(2);
    await background;
  },
);

it('joins a coordinator download and retains scanning mappings without duplicating stock reads', async () => {
  const background = fetchHomeStockBundle(filter);
  const foreground = getHomeStockBundle(filter);
  const [downloaded, read] = await Promise.all([background, foreground]);
  expect(read).toBe(downloaded);
  expect(downloaded.scanning).toBe(true);
  expect(downloaded.tradeItems).toEqual([{ id: 'trade', gtin: '123' }]);
  expect(requests.filter((path) => path.startsWith('/v2/'))).toHaveLength(2);
  expect(requests.filter((path) => path.startsWith('/tradeItems'))).toHaveLength(2);
});

it('keeps a scan-enabled program usable when a referenced trade item is missing', async () => {
  const adapter = client.defaults.adapter as import('axios').AxiosAdapter;
  client.defaults.adapter = async (config) =>
    config.url === '/tradeItems'
      ? { data: { content: [], totalPages: 1 }, status: 200, statusText: 'OK', headers: {}, config }
      : adapter(config);
  const downloaded = await fetchHomeStockBundle(filter);
  expect(downloaded.scanning).toBe(true);
  expect(downloaded.cards).toHaveLength(2);
  expect(downloaded.tradeItems).toEqual([]);
});

it('restarts its own read when coordinator trade items fail with 500', async () => {
  const adapter = client.defaults.adapter as import('axios').AxiosAdapter;
  let fail!: () => void;
  const held = new Promise<void>((resolve) => {
    fail = resolve;
  });
  client.defaults.adapter = async (config) => {
    if (config.url === '/tradeItems') {
      await held;
      throw new AxiosError('Failed', AxiosError.ERR_BAD_RESPONSE, config, undefined, {
        data: {},
        status: 500,
        statusText: 'Failed',
        headers: {},
        config,
      });
    }
    return adapter(config);
  };
  const background = fetchHomeStockBundle(filter);
  const rejected = expect(background).rejects.toMatchObject({ response: { status: 500 } });
  const foreground = getHomeStockBundle(filter);
  fail();
  await rejected;
  expect((await foreground).cards).toHaveLength(2);
  expect(requests.filter((path) => path.startsWith('/v2/'))).toHaveLength(4);
});

it('rejects a missing lot and the coordinator retains the previous complete generation', async () => {
  const saved = await fetchHomeStockBundle({ ...filter, scanning: false });
  await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).put(saved);
  const adapter = client.defaults.adapter as import('axios').AxiosAdapter;
  client.defaults.adapter = async (config) =>
    config.url === '/lots'
      ? { data: { content: [], totalPages: 1 }, status: 200, statusText: 'OK', config, headers: {} }
      : adapter(config);
  await expect(fetchHomeStockBundle(filter)).rejects.toThrow('lot not found');
  vi.stubGlobal('navigator', {
    locks: { request: async (_name: string, _options: unknown, run: () => Promise<void>) => run() },
  });
  const program = { id: 'program', code: 'P', name: 'Program', active: true };
  const access = {
    permissions: async () => ['STOCK_ADJUST|home|program', 'STOCK_CARDS_VIEW|home|program'],
    user: async () => ({
      id: 'bundle-user',
      username: 'user',
      firstName: '',
      lastName: '',
      active: true,
      roleAssignments: [],
      homeFacilityId: 'home',
    }),
    programs: async () => [program],
    home: async () => ({
      id: 'home',
      code: 'H',
      name: 'Home',
      active: true,
      enabled: true,
      type: { id: 'type', code: 'T', name: 'Type' },
      geographicZone: { id: 'zone', code: 'Z', name: 'Zone', level: { name: 'District' } },
      supportedPrograms: [{ ...program, supportActive: true, supportLocallyFulfilled: true }],
    }),
  } satisfies AccessReaders;
  const download = vi.fn(fetchHomeStockBundle);
  const stop = startOfflineCoordinator({
    access: () => access,
    providers: [homeStockProvider(download)],
  });
  try {
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await waitFor(() => expect(getDownloadStatus().phase).toBe('failed'));
    expect(download).toHaveBeenCalled();
    await expect(download.mock.results.at(-1)?.value).rejects.toThrow('lot not found');
    expect(
      await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).get(['home', 'program']),
    ).toEqual(saved);
  } finally {
    stop.stop();
    vi.unstubAllGlobals();
  }
});

it('uses every page and exact product versions for online stock reads as well as downloads', async () => {
  const { fetchEventStockCards } = await import('@/features/stock-events/api/api');
  const cards = await fetchEventStockCards(filter);
  expect(cards.map((card) => card.orderable.meta?.versionNumber)).toEqual([1, 2]);
  expect(cards.map((card) => card.id)).toEqual(['card-1', 'card-2']);
  expect(requests.filter((path) => path.startsWith('/v2/'))).toHaveLength(2);
  expect(requests.some((path) => path.startsWith('/validReasons'))).toBe(false);
});

it.each([{ id: 'missing-root' }, null, undefined])(
  'rejects an unresolved summary product (%s) even when its substitute card resolves',
  async (orderable) => {
    const adapter = client.defaults.adapter as import('axios').AxiosAdapter;
    client.defaults.adapter = async (config) => {
      if (config.url === '/v2/stockCardSummaries')
        return {
          data: {
            content: [
              {
                ...summary(1),
                orderable,
                canFulfillForMe: [
                  {
                    ...summary(1).canFulfillForMe[0],
                    orderable: { id: 'product', versionNumber: 1 },
                  },
                ],
              },
            ],
            totalPages: 1,
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      if (config.url === '/orderables')
        return {
          data: { content: [], totalPages: 1 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      return adapter(config);
    };
    await expect(fetchHomeStockBundle(filter)).rejects.toThrow('Stock summary product not found');
    expect(await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).count()).toBe(0);
  },
);
