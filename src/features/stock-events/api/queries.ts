import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { fetchLotsByTradeItems } from '@/features/reference-data/api/api';
import {
  approvedProductsOptions,
  lotsByTradeItemsOptions,
} from '@/features/reference-data/api/queries';
import {
  fetchAllStockEventLines,
  fetchEventStockCards,
  fetchEventStockOnHand,
  fetchStockEvent,
  fetchStockEventLines,
  fetchStockEvents,
} from '@/features/stock-events/api/api';
import type {
  EventStockCardsFilter,
  EventStockOnHandFilter,
  PageQuery,
  StockEventsQuery,
} from '@/features/stock-events/lib/types';
import { queryKeys } from '@/lib/key-factory';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const eventStockCardsOptions = (filter: EventStockCardsFilter) =>
  queryOptions({
    queryKey: queryKeys.stockEvents.list(filter),
    queryFn: () => fetchEventStockCards(filter),
  });

export const stockEventsOptions = (query: StockEventsQuery) =>
  queryOptions({
    queryKey: queryKeys.stockEvents.list(query),
    queryFn: () => fetchStockEvents(query),
  });

export const stockEventOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.stockEvents.detail(id),
    queryFn: () => fetchStockEvent(id),
  });

export const stockEventLinesOptions = (id: string, query: PageQuery) =>
  queryOptions({
    queryKey: [...queryKeys.stockEvents.detail(id), 'lines', query] as const,
    queryFn: () => fetchStockEventLines(id, query),
  });

export const stockEventAllLinesOptions = (id: string) =>
  queryOptions({
    queryKey: [...queryKeys.stockEvents.detail(id), 'lines', 'all'] as const,
    queryFn: () => fetchAllStockEventLines(id),
    staleTime: 0,
  });

export const eventStockOnHandOptions = (filter: EventStockOnHandFilter) =>
  queryOptions({
    queryKey: queryKeys.stockCardSummaries.list(filter),
    queryFn: () => fetchEventStockOnHand(filter),
    staleTime: 0,
  });

const APPROVED_PRODUCTS_PAGE_SIZE = 50;

export const eventApprovedProductsOptions = (
  filter: EventStockCardsFilter,
  name: string,
  page: number,
) => approvedProductsOptions({ ...filter, name, page, size: APPROVED_PRODUCTS_PAGE_SIZE });

export const eventPickPreloadOptions = (
  queryClient: QueryClient,
  filter: EventStockCardsFilter,
  products: readonly { tradeItemId: string | undefined; approvedId: string }[],
) => {
  const tradeItemIds = [
    ...new Set(products.flatMap(({ tradeItemId }) => (tradeItemId ? [tradeItemId] : []))),
  ].toSorted();
  const orderableIds = [...new Set(products.map(({ approvedId }) => approvedId))].toSorted();
  return queryOptions({
    queryKey: [
      ...queryKeys.stockCardSummaries.all,
      'pick-preload',
      filter,
      tradeItemIds,
      orderableIds,
    ] as const,
    queryFn: async () => {
      const scope = getSessionScope();
      const [lots, stock] = await Promise.all([
        tradeItemIds.length ? fetchLotsByTradeItems(tradeItemIds) : [],
        fetchEventStockOnHand({ ...filter, orderableIds }),
      ]);
      assertSessionScope(scope);
      for (const id of tradeItemIds)
        queryClient.setQueryData(
          lotsByTradeItemsOptions([id]).queryKey,
          lots.filter((lot) => lot.tradeItemId === id),
        );
      for (const id of orderableIds)
        queryClient.setQueryData(
          eventStockOnHandOptions({ ...filter, orderableIds: [id] }).queryKey,
          stock,
        );
      return orderableIds.length;
    },
    enabled: orderableIds.length > 0,
  });
};
