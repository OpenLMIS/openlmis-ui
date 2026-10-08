import { queryOptions } from '@tanstack/react-query';
import {
  fetchEventStockCards,
  fetchStockEvent,
  fetchStockEventLines,
  fetchStockEvents,
} from '@/features/stock-events/api/api';
import type {
  EventStockCardsFilter,
  PageQuery,
  StockEventsQuery,
} from '@/features/stock-events/lib/types';
import { queryKeys } from '@/lib/key-factory';

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
