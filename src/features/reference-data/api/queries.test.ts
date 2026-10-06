import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  orderablesByIdsOptions,
  orderablesByTradeItemsOptions,
  orderablesSearchOptions,
} from '@/features/reference-data/api/queries';
import { queryKeys } from '@/lib/key-factory';

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
