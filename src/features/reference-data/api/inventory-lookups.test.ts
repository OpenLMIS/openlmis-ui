import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchLotsByTradeItems,
  fetchOrderablesByIdentities,
  fetchOrderablesByIds,
} from '@/features/reference-data/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'initial', username: 'initial', accessToken: 'token' });
});

describe('inventory reference lookups', () => {
  it('stops an id lookup before the next batch when the signed-in user changes', async () => {
    vi.mocked(client.get).mockImplementationOnce(async () => {
      useLoginData.setState({ referenceDataUserId: 'changed' });
      return { data: { content: [], totalPages: 1 } };
    });
    await expect(
      fetchOrderablesByIds(Array.from({ length: 101 }, (_, i) => String(i))),
    ).rejects.toThrow();
    expect(client.get).toHaveBeenCalledTimes(1);
  });
  it('reads every lots page of every trade item batch, including expired lots', async () => {
    const lot = { id: 'l', lotCode: 'Old', expirationDate: '2000-01-01', tradeItemId: 't0' };
    vi.mocked(client.get)
      .mockResolvedValueOnce({ data: { content: [lot], totalPages: 2 } })
      .mockResolvedValue({ data: { content: [], totalPages: 1 } });
    expect(await fetchLotsByTradeItems([])).toEqual([]);
    const ids = Array.from({ length: 101 }, (_, i) => `t${i}`);
    expect(await fetchLotsByTradeItems(ids)).toEqual([lot]);
    expect(client.get).toHaveBeenCalledTimes(3);
    expect(client.get).toHaveBeenCalledWith('/lots', {
      params: { tradeItemId: ['t100'], page: 0, size: 100 },
      paramsSerializer: { indexes: null },
    });
    expect(client.get).toHaveBeenCalledWith('/lots', {
      params: { tradeItemId: ids.slice(0, 100), page: 1, size: 100 },
      paramsSerializer: { indexes: null },
    });
  });
});

it('batches versioned products, reads every page and keeps the latest across batches', async () => {
  const identities = Array.from({ length: 250 }, (_, i) => ({ id: `p${i}`, versionNumber: 1 }));
  identities[249] = { id: 'p0', versionNumber: 2 };
  const products = identities.map(({ id, versionNumber }) => ({ id, meta: { versionNumber } }));
  type SearchBody = { identities: typeof identities; page: number; size: number };
  vi.mocked(client.post).mockImplementation(async (_path, body) => {
    const { identities: batch, page } = body as SearchBody;
    const pageIdentities = batch.slice(page * 50, (page + 1) * 50);
    return {
      data: {
        content: pageIdentities.map(({ id, versionNumber }) => ({ id, meta: { versionNumber } })),
        totalPages: Math.ceil(batch.length / 50),
      },
    };
  });
  expect(await fetchOrderablesByIdentities([])).toEqual([]);
  expect(await fetchOrderablesByIdentities([...identities, identities[0]])).toEqual([
    products[249],
    ...products.slice(1, 249),
  ]);
  expect(client.post).toHaveBeenCalledTimes(5);
  for (const [path, body] of vi.mocked(client.post).mock.calls) {
    expect(path).toBe('/orderables/search');
    expect((body as SearchBody).identities.length).toBeLessThanOrEqual(100);
    expect((body as SearchBody).size).toBe(100);
  }
  for (let start = 0; start < identities.length; start += 100) {
    const batch = identities.slice(start, start + 100);
    for (let page = 0; page < Math.ceil(batch.length / 50); page += 1) {
      expect(client.post).toHaveBeenCalledWith('/orderables/search', {
        identities: batch,
        page,
        size: 100,
      });
    }
  }
  expect(client.get).not.toHaveBeenCalled();
});

it('stops versioned search pagination when the session changes', async () => {
  vi.mocked(client.post).mockImplementationOnce(async () => {
    useLoginData.setState({ referenceDataUserId: 'changed' });
    return { data: { content: [], totalPages: 2 } };
  });
  await expect(fetchOrderablesByIdentities([{ id: 'p', versionNumber: 1 }])).rejects.toThrow();
  expect(client.post).toHaveBeenCalledTimes(1);
});
