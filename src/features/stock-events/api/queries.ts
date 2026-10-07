import { queryOptions } from '@tanstack/react-query';
import { fetchEventStockCards } from '@/features/stock-events/api/api';
import type { EventStockCardsFilter } from '@/features/stock-events/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const eventStockCardsOptions = (filter: EventStockCardsFilter) =>
  queryOptions({
    queryKey: queryKeys.stockEvents.list(filter),
    queryFn: () => fetchEventStockCards(filter),
  });
