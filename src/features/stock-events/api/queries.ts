import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { fetchValidReasons } from '@/features/reference-data/api/api';
import {
  approvedProductsOptions,
  tradeItemByGtinOptions,
} from '@/features/reference-data/api/queries';
import {
  fetchAllStockEventLines,
  fetchEventStockCards,
  fetchEventStockOnHand,
  fetchStockEvent,
  fetchStockEventLines,
  fetchStockEvents,
} from '@/features/stock-events/api/api';
import {
  getHomeStockBundle,
  type HomeStockScope,
  readHomeStockBundle,
} from '@/features/stock-events/lib/home-stock-bundle';
import type {
  EventStockCardsFilter,
  EventStockOnHandFilter,
  PageQuery,
  StockEventsQuery,
} from '@/features/stock-events/lib/types';
import { getFlag } from '@/lib/feature-flags';
import { homeStockBundleKeys, queryKeys } from '@/lib/key-factory';
import { LocalDataUnavailableError, onlineOrDevice } from '@/lib/local-data';

export const homeStockScope = (
  filter: EventStockCardsFilter,
  facilityTypeId: string,
): HomeStockScope => ({ ...filter, facilityTypeId, scanning: getFlag('GS1_SCANNING') });

export const eventStockCardsOptions = (filter: EventStockCardsFilter, bundle?: HomeStockScope) =>
  queryOptions({
    queryKey: bundle ? homeStockBundleKeys.cards(bundle) : queryKeys.stockEvents.list(filter),
    queryFn: async () =>
      bundle ? (await getHomeStockBundle(bundle)).cards : fetchEventStockCards(filter),
    networkMode: 'always',
  });

export const eventValidReasonsOptions = (
  filter: { program: string; facilityType: string },
  bundle?: HomeStockScope,
) =>
  queryOptions({
    queryKey: bundle ? homeStockBundleKeys.reasons(bundle) : queryKeys.validReasons.list(filter),
    queryFn: async () =>
      bundle ? (await getHomeStockBundle(bundle)).reasons : fetchValidReasons(filter),
    networkMode: 'always',
  });

export async function fetchHomeStockTradeItem(
  queryClient: QueryClient,
  filter: HomeStockScope,
  gtin: string,
) {
  return onlineOrDevice(
    async () => ({
      tradeItem: await queryClient.fetchQuery(tradeItemByGtinOptions(gtin)),
      offline: false,
    }),
    async () => {
      const bundle = await readHomeStockBundle(filter);
      if (!bundle.scanning) throw new LocalDataUnavailableError();
      return {
        tradeItem: bundle.tradeItems.find((item) => item.gtin === gtin) ?? null,
        offline: true,
      };
    },
  );
}

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

const APPROVED_PRODUCTS_PAGE_SIZE = 100;

export const eventApprovedProductsOptions = (
  filter: EventStockCardsFilter,
  name: string,
  page: number,
) => approvedProductsOptions({ ...filter, name, page, size: APPROVED_PRODUCTS_PAGE_SIZE });
