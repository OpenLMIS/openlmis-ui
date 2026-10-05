import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLot, fetchLotRows, updateLot } from '@/features/lots/api/api';
import type { Lot } from '@/features/lots/lib/types';
import { fetchOrderablesByTradeItems } from '@/features/reference-data/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), put: vi.fn() } }));
vi.mock('@/features/reference-data/api/api', () => ({ fetchOrderablesByTradeItems: vi.fn() }));

const get = vi.mocked(client.get);
const put = vi.mocked(client.put);
const byTradeItems = vi.mocked(fetchOrderablesByTradeItems);

const lot = (id: string, tradeItemId: string): Lot => ({
  id,
  lotCode: id.toUpperCase(),
  active: true,
  tradeItemId,
  expirationDate: '2019-01-30',
  manufactureDate: null,
});

const c1 = {
  id: 'c1',
  productCode: 'C1',
  fullProductName: 'Acetylsalicylic Acid',
  description: null,
  identifiers: { tradeItem: 't1' },
};

const query = { page: 0, size: 10, tradeItemIdIgnored: true as const };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchLotRows', () => {
  it('reads a page of lots, then the products of their trade items only', async () => {
    get.mockResolvedValueOnce({
      data: { content: [lot('l1', 't1'), lot('l2', 't1')], totalElements: 12, totalPages: 2 },
    });
    byTradeItems.mockResolvedValueOnce([c1]);

    await expect(fetchLotRows({ ...query, orderableId: 'c1' })).resolves.toEqual({
      content: [
        { ...lot('l1', 't1'), product: c1 },
        { ...lot('l2', 't1'), product: c1 },
      ],
      totalElements: 12,
      totalPages: 2,
    });
    expect(get).toHaveBeenCalledWith('/lots', { params: { ...query, orderableId: 'c1' } });
    expect(byTradeItems).toHaveBeenCalledWith(['t1']);
  });

  it('asks for no products when the page has no lots', async () => {
    get.mockResolvedValueOnce({ data: { content: [], totalElements: 0, totalPages: 0 } });

    await expect(fetchLotRows(query)).resolves.toMatchObject({ content: [] });
    expect(byTradeItems).not.toHaveBeenCalled();
  });
});

describe('fetchLot', () => {
  it('reads one lot', async () => {
    get.mockResolvedValueOnce({ data: lot('l1', 't1') });

    await expect(fetchLot('l1')).resolves.toEqual(lot('l1', 't1'));
    expect(get).toHaveBeenCalledWith('/lots/l1');
  });
});

describe('updateLot', () => {
  it('sends the whole lot back', async () => {
    put.mockResolvedValueOnce({ data: lot('l1', 't1') });

    await updateLot(lot('l1', 't1'));
    expect(put).toHaveBeenCalledWith('/lots/l1', lot('l1', 't1'));
  });
});
