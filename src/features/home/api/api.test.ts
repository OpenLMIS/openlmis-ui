import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchApprovals,
  fetchEquipmentStatusCounts,
  fetchOpenOrdersCount,
  fetchSystemNotifications,
} from '@/features/home/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

const get = vi.mocked(client.get);
const paramsOf = (call: unknown[] | undefined) =>
  (call?.[1] as { params?: Record<string, unknown> } | undefined)?.params;

const page = (totalElements: number, content: unknown[] = []) => ({
  data: { content, totalElements, totalPages: 1, number: 0, size: 1 },
});

beforeEach(() => {
  get.mockReset();
});

describe('counts', () => {
  it('reads a total from a one-row page, repeating list params as Spring binds them', async () => {
    get.mockResolvedValueOnce(page(3));

    await expect(fetchOpenOrdersCount()).resolves.toBe(3);

    const [url, config] = get.mock.calls[0] ?? [];
    expect(url).toBe('/orders');
    expect(config).toMatchObject({
      params: { page: 0, size: 1, status: expect.arrayContaining(['ORDERED', 'IN_ROUTE']) },
      paramsSerializer: { indexes: null },
    });
    expect(paramsOf(get.mock.calls[0])?.status).not.toContain('RECEIVED');
  });

  it('counts each equipment status and keys the totals by status', async () => {
    get
      .mockResolvedValueOnce(page(380))
      .mockResolvedValueOnce(page(0))
      .mockResolvedValueOnce(page(364))
      .mockResolvedValueOnce(page(396));

    await expect(fetchEquipmentStatusCounts()).resolves.toEqual({
      FUNCTIONING: 380,
      NEEDS_ATTENTION: 0,
      AWAITING_REPAIR: 364,
      UNSERVICEABLE: 396,
    });
    expect(get.mock.calls.map((call) => paramsOf(call)?.functionalStatus)).toEqual([
      'FUNCTIONING',
      'NEEDS_ATTENTION',
      'AWAITING_REPAIR',
      'UNSERVICEABLE',
    ]);
  });
});

describe('fetchApprovals', () => {
  it('asks for emergencies first, then the longest waiting', async () => {
    get.mockResolvedValueOnce(page(7, [{ id: 'r1' }]));

    await expect(fetchApprovals(5)).resolves.toEqual({ requisitions: [{ id: 'r1' }], total: 7 });
    expect(paramsOf(get.mock.calls[0])).toEqual({
      page: 0,
      size: 5,
      sort: ['emergency,desc', 'authorizedDate,asc'],
    });
  });
});

describe('fetchSystemNotifications', () => {
  it('reads every active page with author details, newest first', async () => {
    get
      .mockResolvedValueOnce({ data: { content: [{ id: 'new' }], totalPages: 2 } })
      .mockResolvedValueOnce({ data: { content: [{ id: 'old' }], totalPages: 2 } });

    await expect(fetchSystemNotifications()).resolves.toEqual([{ id: 'new' }, { id: 'old' }]);
    expect(get.mock.calls.map((call) => [call[0], paramsOf(call)])).toEqual([
      [
        '/systemNotifications',
        { isDisplayed: true, expand: 'author', page: 0, size: 100, sort: 'createdDate,desc' },
      ],
      [
        '/systemNotifications',
        { isDisplayed: true, expand: 'author', page: 1, size: 100, sort: 'createdDate,desc' },
      ],
    ]);
  });
});

it('cancels every status request when the dashboard query is cancelled', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  const { requisitionStatusCountsOptions } = await import('./queries');
  const { queryKeys } = await import('@/lib/key-factory');
  const cache = new QueryClient();
  get.mockImplementation(() => new Promise(() => {}));
  const loading = cache.prefetchQuery(requisitionStatusCountsOptions());
  expect(get).toHaveBeenCalledTimes(5);
  const signals = get.mock.calls.map(([, config]) => config?.signal);
  expect(signals.every((signal) => signal && !signal.aborted)).toBe(true);
  await cache.cancelQueries({ queryKey: queryKeys.home.all });
  await loading;
  expect(signals.every((signal) => signal?.aborted)).toBe(true);
  cache.clear();
});

it('sends dashboard approval counts through the background gate with cancellation', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  const { approvalsOptions } = await import('@/features/home/api/queries');
  get.mockResolvedValueOnce(page(1));
  const cache = new QueryClient();
  await cache.fetchQuery(approvalsOptions());
  expect(get.mock.calls[0]?.[1]).toMatchObject({
    backgroundDownload: true,
    downloadProvider: 'home',
    signal: expect.any(AbortSignal),
  });
  cache.clear();
});
