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

it('reads all 10003 versioned summary products in one request instead of 101 id batches', async () => {
  const identities = Array.from({ length: 10003 }, (_, i) => ({ id: `p${i}`, versionNumber: 1 }));
  const products = identities.map(({ id, versionNumber }) => ({ id, meta: { versionNumber } }));
  vi.mocked(client.post).mockResolvedValue({ data: { content: products, totalPages: 1 } });
  expect(await fetchOrderablesByIdentities([])).toEqual([]);
  expect(await fetchOrderablesByIdentities([...identities, identities[0]])).toEqual(products);
  expect(client.post).toHaveBeenCalledExactlyOnceWith('/orderables/search', {
    identities,
    page: 0,
    size: 10003,
  });
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
