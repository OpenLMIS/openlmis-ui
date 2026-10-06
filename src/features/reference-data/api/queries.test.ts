import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { fetchOrderables } from '@/features/reference-data/api/api';
import {
  orderablesByIdsOptions,
  orderablesByTradeItemsOptions,
  orderablesSearchOptions,
} from '@/features/reference-data/api/queries';
import { queryKeys } from '@/lib/key-factory';

vi.mock('@/features/reference-data/api/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/reference-data/api/api')>()),
  fetchOrderables: vi.fn(),
}));

describe('product lookups', () => {
  it('are refreshed when a product save refreshes the product lists', async () => {
    const queryClient = new QueryClient();
    const lookups = [
      orderablesSearchOptions({ name: 'acid' }),
      orderablesByIdsOptions(['o1']),
      orderablesByTradeItemsOptions(['t1']),
    ];
    for (const { queryKey } of lookups) queryClient.setQueryData(queryKey, []);

    await queryClient.invalidateQueries({ queryKey: [...queryKeys.orderables.all, 'list'] });

    for (const { queryKey } of lookups) {
      expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });
});

describe('orderablesSearchOptions', () => {
  it('trims the search once, so the cache key and the request agree', async () => {
    vi.mocked(fetchOrderables).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 20,
    });
    const options = orderablesSearchOptions({ name: ' acid ', code: ' C1 ' });

    expect(options.queryKey).toEqual(
      orderablesSearchOptions({ name: 'acid', code: 'C1' }).queryKey,
    );
    await new QueryClient().fetchQuery(options);
    expect(fetchOrderables).toHaveBeenCalledWith({ name: 'acid', code: 'C1' });
  });
});
