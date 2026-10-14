import { onlineManager } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { client } from '@/integrations/axios';
import { getLocalDb } from '@/integrations/local-db';
import {
  fetchAdjustmentBundle,
  getAdjustmentBundle,
  readAdjustmentBundle,
} from '@/lib/adjustment-bundle';
import { LocalDataUnavailableError } from '@/lib/local-data';

const filter = { facilityId: 'home', programId: 'program', facilityTypeId: 'type', scanning: true };
const product = (versionNumber: number) => ({
  id: 'product',
  productCode: 'MED',
  fullProductName: `Version ${versionNumber}`,
  description: 'discard',
  netContent: 10,
  identifiers: { tradeItem: 'trade', secret: 'discard' },
  dispensable: { displayUnit: 'tablet', secret: 'discard' },
  extraData: { useVVM: 'true', secret: 'discard' },
  meta: { versionNumber, secret: 'discard' },
});
const summary = (versionNumber: number) => ({
  orderable: { id: 'product', versionNumber },
  canFulfillForMe: [
    {
      stockCard: { id: `card-${versionNumber}` },
      orderable: { id: 'product' },
      lot: { id: 'lot' },
      stockOnHand: versionNumber,
    },
  ],
});
let requests: string[];
const originalAdapter = client.defaults.adapter;
beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'bundle-user', username: 'user', accessToken: 'token' });
  await getLocalDb().table('adjustmentDownloads').clear();
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
    getAdjustmentBundle(filter),
    getAdjustmentBundle(filter),
  ]);
  expect(first).toBe(second);
  expect(first.cards.map((card) => card.orderable.meta?.versionNumber)).toEqual([1, 2]);
  expect(requests.filter((path) => path.startsWith('/v2/'))).toHaveLength(2);
  expect(requests.filter((path) => path.startsWith('/orderables/search'))).toHaveLength(2);
  expect(JSON.stringify(first)).not.toContain('discard');
  expect(first.tradeItems).toEqual([]);
  expect(requests.filter((path) => path.startsWith('/tradeItems'))).toHaveLength(0);
  expect(await getLocalDb().table('adjustmentDownloads').count()).toBe(0);
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
  await expect(getAdjustmentBundle(filter)).rejects.toThrow('product');
});

it('runs offline and rejects a missing bundle with local-unavailable instead of an empty list', async () => {
  onlineManager.setOnline(false);
  await expect(getAdjustmentBundle(filter)).rejects.toBeInstanceOf(LocalDataUnavailableError);
  await expect(readAdjustmentBundle(filter)).rejects.toBeInstanceOf(LocalDataUnavailableError);
  expect(requests).toEqual([]);
});

it('falls back on a timed-out read but never on service refusal or cancellation', async () => {
  const saved = await getAdjustmentBundle(filter);
  await getLocalDb().table('adjustmentDownloads').put(saved);
  client.defaults.adapter = async () => {
    throw new AxiosError('Timed out', AxiosError.ECONNABORTED);
  };
  await expect(getAdjustmentBundle(filter)).resolves.toEqual(saved);
  const refusal = Object.assign(new AxiosError('Refused'), { response: { status: 403, data: {} } });
  client.defaults.adapter = async () => {
    throw refusal;
  };
  await expect(getAdjustmentBundle(filter)).rejects.toBe(refusal);
  const canceled = new AxiosError('Canceled', AxiosError.ERR_CANCELED);
  client.defaults.adapter = async () => {
    throw canceled;
  };
  await expect(getAdjustmentBundle(filter)).rejects.toBe(canceled);
});

it('bounds timed-out background reads without declaring the browser offline', async () => {
  const adapter = vi.fn(async () => {
    throw new AxiosError('Timed out', AxiosError.ECONNABORTED);
  });
  client.defaults.adapter = adapter;
  await expect(fetchAdjustmentBundle(filter)).rejects.toMatchObject({
    code: AxiosError.ECONNABORTED,
  });
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(onlineManager.isOnline()).toBe(true);
});

it('serves online editor reads without Web Locks and never persists them', async () => {
  vi.stubGlobal('navigator', {});
  try {
    expect((await getAdjustmentBundle(filter)).cards).toHaveLength(2);
    expect(await getLocalDb().table('adjustmentDownloads').count()).toBe(0);
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
  const saved = await getAdjustmentBundle(filter);
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
    const background = fetchAdjustmentBundle(filter, controller.signal);
    const rejected = expect(background).rejects.toThrow();
    await downloading;
    const foreground = getAdjustmentBundle(filter);
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
        ? expect(fetchAdjustmentBundle(filter)).rejects.toMatchObject({
            code: AxiosError.ERR_CANCELED,
          })
        : undefined;
    const result = getAdjustmentBundle(filter);
    await waitFor(() => expect(useLoginData.getState().expired).toBe(true));
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'bundle-user',
      username: 'user',
      accessToken: 'renewed',
    });
    expect((await result).cards).toHaveLength(2);
    expect(refused).toHaveBeenCalledTimes(1);
    await background;
  },
);

it('joins a coordinator download and retains scanning mappings without duplicating stock reads', async () => {
  const background = fetchAdjustmentBundle(filter);
  const foreground = getAdjustmentBundle(filter);
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
  const downloaded = await fetchAdjustmentBundle(filter);
  expect(downloaded.scanning).toBe(true);
  expect(downloaded.cards).toHaveLength(2);
  expect(downloaded.tradeItems).toEqual([]);
});
