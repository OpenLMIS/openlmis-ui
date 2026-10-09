import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLot,
  fetchLotsByTradeItems,
  fetchOrderableFulfills,
} from '@/features/reference-data/api/api';
import {
  lotsByTradeItemsOptions,
  orderableFulfillsOptions,
} from '@/features/reference-data/api/queries';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

describe('inventory reference lookups', () => {
  it('skips empty ids and batches fulfills into at most 100 unique ids', async () => {
    vi.mocked(client.get).mockResolvedValue({
      data: { p: { canFulfillForMe: ['t'], canBeFulfilledByMe: [] } },
    });
    expect(await fetchOrderableFulfills([])).toEqual({});
    const ids = Array.from({ length: 101 }, (_, i) => `p${i}`);
    expect(await fetchOrderableFulfills([...ids, ids[0]])).toHaveProperty('p.canFulfillForMe', [
      't',
    ]);
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.get).toHaveBeenNthCalledWith(2, '/orderableFulfills', {
      params: { id: ['p100'] },
      paramsSerializer: { indexes: null },
    });
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
    expect(client.get).toHaveBeenNthCalledWith(3, '/lots', {
      params: { tradeItemId: ['t100'], page: 0, size: 100 },
      paramsSerializer: { indexes: null },
    });
  });
  it('creates a lot with the legacy fields and keeps lookup keys independent', async () => {
    const lot = { lotCode: 'New', expirationDate: null, tradeItemId: 't', active: true as const };
    vi.mocked(client.post).mockResolvedValue({ data: { id: 'l', ...lot } });
    expect(await createLot(lot)).toMatchObject({ id: 'l' });
    expect(client.post).toHaveBeenCalledWith('/lots', lot);
    expect(lotsByTradeItemsOptions(['t']).queryKey).not.toEqual(
      orderableFulfillsOptions(['t']).queryKey,
    );
    expect(orderableFulfillsOptions(['b', 'a', 'a']).queryKey).toEqual(
      orderableFulfillsOptions(['a', 'b']).queryKey,
    );
  });
});
