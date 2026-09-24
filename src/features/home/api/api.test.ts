import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchApprovals,
  fetchEquipmentStatusCounts,
  fetchOpenOrdersCount,
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
