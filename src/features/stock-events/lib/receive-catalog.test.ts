import { onlineManager } from '@tanstack/react-query';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchReceiveCatalog,
  readReceiveCatalog,
} from '@/features/stock-events/lib/receive-catalog';
import { client } from '@/integrations/axios';
import { LOCAL_TABLES, localTable } from '@/integrations/local-db';
import { LocalDataUnavailableError } from '@/lib/local-data';

const scope = {
  facilityId: 'home',
  programId: 'p',
  facilityTypeId: 'type',
  programCode: 'P',
  scanning: false,
};
const product = (id: string, versionNumber: number) => ({
  id,
  productCode: id,
  fullProductName: id,
  description: 'discard',
  children: [],
  programs: [],
  identifiers: { tradeItem: 'trade', secret: 'discard' },
  meta: { versionNumber, secret: 'discard' },
});
const originalAdapter = client.defaults.adapter;
let requests: InternalAxiosRequestConfig[];
let missing = false;
let summaryPages = 1;
let approvedRows: {
  orderable: { id: string; versionNumber?: number; meta?: { versionNumber: number } };
}[];
beforeEach(async () => {
  onlineManager.setOnline(true);
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'catalog-user', username: 'user', accessToken: 'token' });
  await localTable(LOCAL_TABLES.receiveCatalogDownloads).clear();
  requests = [];
  missing = false;
  summaryPages = 1;
  approvedRows = [
    { orderable: { id: 'approved', meta: { versionNumber: 1 } } },
    { orderable: { id: 'approved', versionNumber: 1 } },
  ];
  client.defaults.adapter = async (config) => {
    requests.push(config);
    const data =
      config.url === '/v2/stockCardSummaries'
        ? {
            content: approvedRows,
            totalPages: summaryPages,
          }
        : config.url === '/orderableFulfills'
          ? {
              approved: { canFulfillForMe: ['fulfiller', 'missing'] },
              other: { canFulfillForMe: ['unused'] },
            }
          : config.url === '/orderables/search'
            ? { content: missing ? [] : [product('approved', 1)], totalPages: 1 }
            : config.url === '/orderables'
              ? {
                  content: config.params.id
                    ? config.params.id
                        .filter((id: string) => id !== 'missing')
                        .map((id: string) => product(id, 3))
                    : [product('approved', 2)],
                  totalPages: 1,
                }
              : config.url === '/lots'
                ? {
                    content: [
                      {
                        id: 'lot',
                        lotCode: 'LOT',
                        expirationDate: null,
                        tradeItemId: 'trade',
                        secret: 'discard',
                      },
                    ],
                    totalPages: 1,
                  }
                : config.url === '/tradeItems'
                  ? {
                      content: [
                        { id: 'trade', gtin: '123', secret: 'discard' },
                        { id: 'without-gtin' },
                      ],
                      totalPages: 1,
                    }
                  : null;
    if (!data) throw new Error(`Unexpected ${config.url}`);
    return { data, status: 200, statusText: 'OK', config, headers: {} };
  };
});
afterEach(() => {
  client.defaults.adapter = originalAdapter;
  useLoginData.getState().clearLoginData();
});

it('downloads the exact approved version, latest fulfiller, slim lots and a single unpaged approved set', async () => {
  const record = await fetchReceiveCatalog(scope);
  expect(record.approved).toEqual([{ id: 'approved', versionNumber: 1 }]);
  expect(record.fulfils).toEqual({ approved: ['fulfiller'] });
  expect(record.products.map(({ id, meta }) => [id, meta?.versionNumber])).toEqual([
    ['fulfiller', 3],
    ['approved', 1],
  ]);
  expect(JSON.stringify(record)).not.toContain('discard');
  expect(record.products.every((item) => !item.children && !item.programs)).toBe(true);
  expect(record.lots).toEqual([
    { id: 'lot', lotCode: 'LOT', expirationDate: null, tradeItemId: 'trade' },
  ]);
  const summaries = requests.filter((request) => request.url === '/v2/stockCardSummaries');
  expect(summaries).toHaveLength(1);
  expect(summaries[0].params).toEqual({ facilityId: 'home', programId: 'p', nonEmptyOnly: false });
  expect(requests.find((request) => request.url === '/orderables/search')?.data).toContain(
    '"versionNumber":1',
  );
  expect(
    requests.find((request) => request.url === '/orderables' && request.params.id)?.params.id,
  ).toEqual(['fulfiller', 'missing']);
  expect(requests.some((request) => request.url === '/tradeItems')).toBe(false);
  for (const request of requests)
    expect(request).toMatchObject({ session: false, backgroundRead: true });
  expect(await localTable(LOCAL_TABLES.receiveCatalogDownloads).count()).toBe(0);
});

it('refuses incomplete approved products and paged summaries', async () => {
  missing = true;
  await expect(fetchReceiveCatalog(scope)).rejects.toThrow('Receive catalog product not found');
  summaryPages = 2;
  await expect(fetchReceiveCatalog(scope)).rejects.toThrow('Incomplete approved stock summaries');
});

it('keeps only GTIN mappings when scanning is enabled', async () => {
  expect((await fetchReceiveCatalog({ ...scope, scanning: true })).tradeItems).toEqual([
    { id: 'trade', gtin: '123' },
  ]);
});

it('rejects records from another owner, format or facility type', async () => {
  const record = await fetchReceiveCatalog(scope);
  for (const change of [{ userId: 'other' }, { formatVersion: 2 }, { facilityTypeId: 'other' }]) {
    await localTable(LOCAL_TABLES.receiveCatalogDownloads).put({ ...record, ...change });
    await expect(readReceiveCatalog(scope)).rejects.toBeInstanceOf(LocalDataUnavailableError);
  }
  await localTable(LOCAL_TABLES.receiveCatalogDownloads).put(record);
  await expect(readReceiveCatalog(scope)).resolves.toEqual(record);
});

it('selects the latest available version when approval has no version and accepts an empty approved set', async () => {
  approvedRows = [{ orderable: { id: 'approved' } }];
  const record = await fetchReceiveCatalog(scope);
  expect(record.approved).toEqual([{ id: 'approved', versionNumber: null }]);
  expect(record.products.find((item) => item.id === 'approved')?.meta?.versionNumber).toBe(2);
  approvedRows = [{ orderable: { id: 'external' } }];
  const backfilled = await fetchReceiveCatalog(scope);
  expect(backfilled.approved).toEqual([{ id: 'external', versionNumber: null }]);
  expect(backfilled.products.map(({ id, meta }) => [id, meta?.versionNumber])).toEqual([
    ['external', 3],
  ]);
  expect(requests.filter((request) => request.url === '/orderables').at(-1)?.params.id).toEqual([
    'external',
  ]);
  approvedRows = [];
  const empty = await fetchReceiveCatalog(scope);
  expect(empty.approved).toEqual([]);
  expect(empty.products).toEqual([]);
  expect(empty.lots).toEqual([]);
});

it('starts GTIN lookup before the independent lots lookup finishes', async () => {
  const adapter = client.defaults.adapter as AxiosAdapter;
  let releaseLots!: () => void;
  let lotsStarted!: () => void;
  const lotsReady = new Promise<void>((resolve) => {
    lotsStarted = resolve;
  });
  const lotsPending = new Promise<void>((resolve) => {
    releaseLots = resolve;
  });
  let gtinStarted = false;
  client.defaults.adapter = async (config) => {
    if (config.url === '/lots') {
      lotsStarted();
      await lotsPending;
    }
    if (config.url === '/tradeItems') gtinStarted = true;
    return adapter(config);
  };
  const download = fetchReceiveCatalog({ ...scope, scanning: true });
  await lotsReady;
  try {
    expect(gtinStarted).toBe(true);
  } finally {
    releaseLots();
    await download;
  }
});
