import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLotsByIds, fetchOrderablesByIds } from '@/features/reference-data/api/api';
import {
  prefetchStockOnHand,
  stockCardSummariesOptions,
} from '@/features/stock-on-hand/api/queries';

vi.mock('@/features/reference-data/api/api', () => ({
  fetchOrderablesByIds: vi.fn(),
  fetchLotsByIds: vi.fn(),
}));
vi.mock('@/features/stock-on-hand/api/api', () => ({ fetchStockCardSummaries: vi.fn() }));

beforeEach(() => {
  vi.mocked(fetchOrderablesByIds).mockResolvedValue([]);
  vi.mocked(fetchLotsByIds).mockResolvedValue([]);
});

const query = {
  facilityId: 'f1',
  programId: 'p1',
  nonEmptyOnly: true,
  page: 0,
  size: 10,
} as const;

const stock = {
  content: [
    {
      orderable: { id: 'o1' },
      stockOnHand: 1,
      canFulfillForMe: [
        {
          stockCard: { id: 'c1' },
          orderable: { id: 'o1' },
          lot: { id: 'l1' },
          stockOnHand: 1,
          occurredDate: null,
          active: true,
        },
      ],
    },
  ],
  totalElements: 1,
  totalPages: 1,
  number: 0,
  size: 10,
};

describe('prefetchStockOnHand', () => {
  it('asks for no names once the cache was cleared, as on signing out', async () => {
    vi.clearAllMocks();
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
    queryClient.setQueryData(stockCardSummariesOptions(query, undefined, true).queryKey, stock);
    const fetch = vi.spyOn(queryClient, 'fetchQuery');
    prefetchStockOnHand(queryClient, query, undefined, true);

    queryClient.clear();
    await fetch.mock.results[0].value;

    expect(fetchOrderablesByIds).not.toHaveBeenCalled();
    expect(fetchLotsByIds).not.toHaveBeenCalled();
  });
});
