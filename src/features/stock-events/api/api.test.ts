import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchEventStockCards, submitStockEvent } from '@/features/stock-events/api/api';
import type { StockEvent } from '@/features/stock-events/lib/types';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), post: vi.fn() } }));
const get = vi.mocked(client.get);
beforeEach(() => vi.resetAllMocks());
const selection = { programId: 'p1', facilityId: 'f1' };

describe('fetchEventStockCards', () => {
  it('reads every v1 page even when the server sends fewer rows than requested', async () => {
    get.mockResolvedValueOnce({ data: { content: [{ id: 's1' }], totalPages: 2 } });
    get.mockResolvedValueOnce({ data: { content: [{ id: 's2' }], totalPages: 2 } });
    await expect(fetchEventStockCards(selection)).resolves.toEqual([{ id: 's1' }, { id: 's2' }]);
    expect(get).toHaveBeenNthCalledWith(1, '/stockCardSummaries', {
      params: { program: 'p1', facility: 'f1', page: 0, size: 100 },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/stockCardSummaries', {
      params: { program: 'p1', facility: 'f1', page: 1, size: 100 },
    });
  });
  it('stops after an empty first page', async () => {
    get.mockResolvedValueOnce({ data: { content: [], totalPages: 0 } });
    await expect(fetchEventStockCards(selection)).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('rejects a failed later page instead of caching a partial stock list', async () => {
    get.mockResolvedValueOnce({ data: { content: [{ id: 's1' }], totalPages: 2 } });
    get.mockRejectedValueOnce(new Error('Unavailable'));
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
