import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/key-factory';

export const ORDER_LISTS_KEY = [...queryKeys.orders.all, 'list'] as const;
export const ORDER_REQUESTING_FACILITIES_KEY = [
  ...queryKeys.orders.all,
  'requesting-facilities',
] as const;

export function invalidateOrderLists(queryClient: QueryClient): Promise<unknown> {
  return Promise.all(
    [ORDER_LISTS_KEY, ORDER_REQUESTING_FACILITIES_KEY, queryKeys.home.all].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
