import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLotsByIds, fetchOrderablesByIds } from '@/features/reference-data/api/api';
import { fetchEventStockCards, submitStockEvent } from '@/features/stock-events/api/api';
import type { StockEvent } from '@/features/stock-events/lib/types';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchOrderablesByIds: vi.fn(),
  fetchLotsByIds: vi.fn(),
}));
const get = vi.mocked(client.get);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchOrderablesByIds).mockResolvedValue([]);
  vi.mocked(fetchLotsByIds).mockResolvedValue([]);
});
const selection = { programId: 'p1', facilityId: 'f1' };

const product = { id: 'o1', productCode: 'C1', fullProductName: 'Product', description: null };
const lot = { id: 'l1', lotCode: 'L1', expirationDate: '2027-01-01' };
const summaryCard = {
  stockCard: { id: 's1' },
  orderable: { id: 'o1' },
  lot: { id: 'l1' },
  stockOnHand: 10,
  active: false,
};

describe('fetchEventStockCards', () => {
  it('reads v2 with legacy params, resolves fulfilling products and lots, dedupes cards and keeps inactive stock', async () => {
    get.mockResolvedValueOnce({
      data: {
        content: [
          { orderable: { id: 'approved' }, canFulfillForMe: [summaryCard] },
          {
            orderable: { id: 'another' },
            canFulfillForMe: [summaryCard, { ...summaryCard, stockCard: { id: 's2' }, lot: null }],
          },
        ],
      },
    });
    vi.mocked(fetchOrderablesByIds).mockResolvedValueOnce([product]);
    vi.mocked(fetchLotsByIds).mockResolvedValueOnce([lot]);
    await expect(fetchEventStockCards(selection)).resolves.toEqual([
      { id: 's1', orderable: product, lot, stockOnHand: 10 },
      { id: 's2', orderable: product, lot: null, stockOnHand: 10 },
    ]);
    expect(get).toHaveBeenCalledExactlyOnceWith('/v2/stockCardSummaries', {
      params: { ...selection, nonEmptyOnly: true },
    });
    expect(fetchOrderablesByIds).toHaveBeenCalledExactlyOnceWith(['o1', 'o1']);
    expect(fetchLotsByIds).toHaveBeenCalledExactlyOnceWith(['l1']);
  });
  it('passes no-lot stock to the empty-id lookup', async () => {
    get.mockResolvedValueOnce({
      data: { content: [{ canFulfillForMe: [{ ...summaryCard, lot: null }] }] },
    });
    vi.mocked(fetchOrderablesByIds).mockResolvedValueOnce([product]);
    await expect(fetchEventStockCards(selection)).resolves.toEqual([
      { id: 's1', orderable: product, lot: null, stockOnHand: 10 },
    ]);
    expect(fetchLotsByIds).toHaveBeenCalledExactlyOnceWith([]);
  });
  it('offers no cards for products absent from v2, without looking up unrelated records', async () => {
    get.mockResolvedValueOnce({ data: { content: [{ canFulfillForMe: [] }] } });
    await expect(fetchEventStockCards(selection)).resolves.toEqual([]);
    expect(fetchOrderablesByIds).toHaveBeenCalledExactlyOnceWith([]);
    expect(fetchLotsByIds).toHaveBeenCalledExactlyOnceWith([]);
  });
  it('rejects unresolved products or lots instead of offering incomplete cards', async () => {
    for (const missing of ['product', 'lot']) {
      get.mockResolvedValueOnce({ data: { content: [{ canFulfillForMe: [summaryCard] }] } });
      vi.mocked(fetchOrderablesByIds).mockResolvedValueOnce(missing === 'product' ? [] : [product]);
      vi.mocked(fetchLotsByIds).mockResolvedValueOnce(missing === 'lot' ? [] : [lot]);
      await expect(fetchEventStockCards(selection)).rejects.toThrow();
    }
  });
  it('rejects a failed hydration instead of caching a partial list', async () => {
    get.mockResolvedValueOnce({ data: { content: [{ canFulfillForMe: [summaryCard] }] } });
    vi.mocked(fetchOrderablesByIds).mockRejectedValueOnce(new Error('Unavailable'));
    vi.mocked(fetchLotsByIds).mockResolvedValueOnce([lot]);
    await expect(fetchEventStockCards(selection)).rejects.toThrow('Unavailable');
  });
});

describe('submitStockEvent', () => {
  it('sends doses and optional event data unchanged and returns the JSON UUID', async () => {
    const body: StockEvent = {
      ...selection,
      signature: '',
      eventOrigin: 'ADJUSTMENT',
      lineItems: [
        {
          orderableId: 'o1',
          quantity: 50,
          occurredDate: '2026-10-07',
          reasonId: 'r1',
          lotId: 'l1',
          reasonFreeText: 'Broken',
          extraData: { vvmStatus: 'STAGE_1' },
        },
      ],
    };
    vi.mocked(client.post).mockResolvedValueOnce({ data: 'event-id' });
    await expect(submitStockEvent(body)).resolves.toBe('event-id');
    expect(client.post).toHaveBeenCalledWith('/stockEvents', body);
  });
});
