import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  cancelStockEvent,
  fetchAllStockEventLines,
  fetchEventStockCards,
  fetchEventStockOnHand,
  submitStockEvent,
} from '@/features/stock-events/api/api';
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

describe('reverse event requests', () => {
  it('sends the cancellation body unchanged and returns the new event id', async () => {
    const body = { signature: '', lineItems: [{ stockEventLineItemId: null, reasonId: 'r1' }] };
    vi.mocked(client.post).mockResolvedValueOnce({ data: 'new-event' });
    await expect(cancelStockEvent('event', body)).resolves.toBe('new-event');
    expect(client.post).toHaveBeenCalledWith('/stockEvents/event/cancel', body);
  });

  it('also accepts the legacy object response', async () => {
    vi.mocked(client.post).mockResolvedValueOnce({ data: { id: 'new-event' } });
    await expect(cancelStockEvent('event', { signature: '', lineItems: [] })).resolves.toBe(
      'new-event',
    );
  });

  it('reads all line pages in server order with the Spring page cap', async () => {
    get.mockResolvedValueOnce({
      data: { content: [{ quantity: 2 }, { quantity: 1 }], last: false, totalPages: 2 },
    });
    get.mockResolvedValueOnce({ data: { content: [{ quantity: 3 }], last: true, totalPages: 2 } });
    await expect(fetchAllStockEventLines('event')).resolves.toEqual([
      { quantity: 2 },
      { quantity: 1 },
      { quantity: 3 },
    ]);
    expect(get).toHaveBeenNthCalledWith(1, '/stockEvents/event/lineItems', {
      params: { page: 0, size: 2000 },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/stockEvents/event/lineItems', {
      params: { page: 1, size: 2000 },
    });
  });

  it('rejects a failed later line page', async () => {
    get.mockResolvedValueOnce({ data: { content: [], last: false, totalPages: 2 } });
    get.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(fetchAllStockEventLines('event')).rejects.toThrow('Unavailable');
  });

  it('batches unique products by 100 and reads each v2 page using the entry ids', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => String(i));
    get.mockResolvedValueOnce({
      data: {
        content: [
          {
            orderable: { id: 'parent' },
            stockOnHand: 999,
            canFulfillForMe: [
              { orderable: { id: '0' }, lot: null, stockOnHand: 0 },
              { orderable: { id: 'substitute' }, lot: { id: 'lot' }, stockOnHand: 12 },
            ],
          },
        ],
        totalPages: 2,
      },
    });
    get.mockResolvedValueOnce({
      data: {
        content: [
          { canFulfillForMe: [{ orderable: { id: '0' }, lot: { id: 'other' }, stockOnHand: 4 }] },
        ],
        totalPages: 2,
      },
    });
    get.mockResolvedValueOnce({ data: { content: [], totalPages: 1 } });
    await expect(
      fetchEventStockOnHand({ ...selection, orderableIds: [...ids, '0'] }),
    ).resolves.toEqual({
      '0/': 0,
      'substitute/lot': 12,
      '0/other': 4,
    });
    for (const [index, page, batch] of [
      [1, 0, ids.slice(0, 100)],
      [2, 1, ids.slice(0, 100)],
      [3, 0, ['100']],
    ] as const) {
      expect(get).toHaveBeenNthCalledWith(index, '/v2/stockCardSummaries', {
        params: { ...selection, orderableId: batch, page, size: 100 },
        paramsSerializer: { indexes: null },
      });
    }
  });

  it('does not request unfiltered stock when there are no products', async () => {
    await expect(fetchEventStockOnHand({ ...selection, orderableIds: [] })).resolves.toEqual({});
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects a failed stock page so the caller can use the line fallback', async () => {
    get.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(fetchEventStockOnHand({ ...selection, orderableIds: ['o1'] })).rejects.toThrow(
      'Unavailable',
    );
  });
});

describe('reverse read boundaries', () => {
  it('stops on the server last-page marker', async () => {
    get.mockResolvedValueOnce({ data: { content: [], last: true } });
    await expect(fetchAllStockEventLines('event')).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it.each(['lines', 'stock'] as const)(
    'does not continue %s reads under a changed user',
    async (kind) => {
      const previous = useLoginData.getState().referenceDataUserId;
      get.mockImplementationOnce(async () => {
        useLoginData.setState({ referenceDataUserId: 'other-user' });
        return { data: { content: [], totalPages: 2 } };
      });
      try {
        const result =
          kind === 'lines'
            ? fetchAllStockEventLines('event')
            : fetchEventStockOnHand({ ...selection, orderableIds: ['o1'] });
        await expect(result).rejects.toThrow();
        expect(get).toHaveBeenCalledTimes(1);
      } finally {
        useLoginData.setState({ referenceDataUserId: previous });
      }
    },
  );
});
