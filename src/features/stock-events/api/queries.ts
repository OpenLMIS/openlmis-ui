import { queryOptions } from '@tanstack/react-query';
import { fetchValidReasons } from '@/features/reference-data/api/api';
import { approvedProductsOptions } from '@/features/reference-data/api/queries';
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
import { type AdjustmentScope, getAdjustmentBundle } from '@/lib/adjustment-bundle';
import { getFlag } from '@/lib/feature-flags';
import { queryKeys } from '@/lib/key-factory';
import { LocalDataUnavailableError } from '@/lib/local-data';

export const adjustmentScope = (
  filter: EventStockCardsFilter,
  facilityTypeId: string,
): AdjustmentScope => ({ ...filter, facilityTypeId, scanning: getFlag('GS1_SCANNING') });

export const eventStockCardsOptions = (filter: EventStockCardsFilter, bundle?: AdjustmentScope) =>
  queryOptions({
    queryKey: queryKeys.stockEvents.list(filter),
    queryFn: async () =>
      bundle ? (await getAdjustmentBundle(bundle)).cards : fetchEventStockCards(filter),
    networkMode: 'always',
  });

export const eventValidReasonsOptions = (
  filter: { program: string; facilityType: string },
  bundle?: AdjustmentScope,
) =>
  queryOptions({
    queryKey: queryKeys.validReasons.list(filter),
    queryFn: async () =>
      bundle ? (await getAdjustmentBundle(bundle)).reasons : fetchValidReasons(filter),
    networkMode: 'always',
  });

export const adjustmentTradeItemOptions = (filter: AdjustmentScope, gtin: string) =>
  queryOptions({
    queryKey: [...queryKeys.stockEvents.list(filter), 'adjustment-gtin', gtin],
    queryFn: async () => {
      const bundle = await getAdjustmentBundle(filter);
      const item = bundle.tradeItems.find((item) => item.gtin === gtin);
      if (!item) throw new LocalDataUnavailableError();
      return item;
    },
    networkMode: 'always',
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
