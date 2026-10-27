import { type QueryClient, type QueryKey, queryOptions } from '@tanstack/react-query';
import {
  fetchApprovedProducts,
  fetchFacilityOrderableFulfills,
  fetchLotsByTradeItems,
  fetchOrderablesByIds,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import {
  approvedProductsOptions,
  facilityOrderableFulfillsOptions,
  LOOKUP_STALE_TIME,
  lotsByTradeItemsOptions,
  orderablesByIdsOptions,
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
import { readDeviceNewLots } from '@/features/stock-events/lib/device-new-lots';
import {
  getHomeStockBundle,
  type HomeStockScope,
  readHomeStockBundle,
} from '@/features/stock-events/lib/home-stock-bundle';
import { readReceiveCatalog } from '@/features/stock-events/lib/receive-catalog';
import {
  catalogApprovedPage,
  catalogLots,
  catalogOrderables,
  catalogStock,
  type ReceiveCatalogView,
  receiveCatalogView,
} from '@/features/stock-events/lib/receive-catalog-view';
import type {
  EventStockCardsFilter,
  EventStockOnHandFilter,
  PageQuery,
  StockEventsQuery,
} from '@/features/stock-events/lib/types';
import { deviceQuery } from '@/lib/device-query';
import { getFlag } from '@/lib/feature-flags';
import { homeStockBundleKeys, queryKeys } from '@/lib/key-factory';
import {
  type DeviceSnapshot,
  deviceDataGeneration,
  LocalDataUnavailableError,
  onlineOrDevice,
} from '@/lib/local-data';
import { offlineAccessQuery } from '@/lib/offline-access';

export const homeStockScope = (
  filter: EventStockCardsFilter,
  facilityTypeId: string,
): HomeStockScope => ({ ...filter, facilityTypeId, scanning: getFlag('GS1_SCANNING') });

export const eventStockCardsOptions = (filter: EventStockCardsFilter, bundle?: HomeStockScope) =>
  queryOptions({
    queryKey: bundle ? homeStockBundleKeys.cards(bundle) : queryKeys.stockEvents.list(filter),
    queryFn: async () => {
      if (!bundle) return { cards: await fetchEventStockCards(filter), device: undefined };
      const result = await getHomeStockBundle(bundle);
      const device: DeviceSnapshot | undefined =
        deviceDataGeneration(result) !== undefined
          ? { fetchedAt: result.fetchedAt, generation: result.generation }
          : undefined;
      return { cards: result.cards, device };
    },
    networkMode: 'always',
    staleTime: (query) => (query.state.data?.device ? 0 : 30_000),
    refetchOnReconnect: true,
  });

export const eventValidReasonsOptions = (
  filter: { program: string; facilityType: string },
  bundle?: HomeStockScope,
) =>
  queryOptions({
    queryKey: bundle ? homeStockBundleKeys.reasons(bundle) : queryKeys.validReasons.list(filter),
    queryFn: async () => (bundle ? getHomeStockBundle(bundle) : fetchValidReasons(filter)),
    select: (result) => (Array.isArray(result) ? result : result.reasons),
    networkMode: 'always',
    ...offlineAccessQuery(30_000),
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

export type ReceiveDevice = {
  stock: HomeStockScope;
  online: boolean;
};

export const receiveDevice = (
  filter: EventStockCardsFilter,
  facilityTypeId: string,
  online: boolean,
): ReceiveDevice => ({
  stock: homeStockScope(filter, facilityTypeId),
  online,
});

export const receiveCatalogOptions = (device: ReceiveDevice) =>
  queryOptions({
    queryKey: [...homeStockBundleKeys.cards(device.stock), 'receive-catalog'] as const,
    queryFn: async () => {
      const [catalog, bundle] = await Promise.all([
        readReceiveCatalog(device.stock),
        readHomeStockBundle(device.stock),
      ]);
      return receiveCatalogView(catalog, bundle);
    },
    staleTime: 60_000,
    networkMode: 'always',
  });

function receiveQuery<T>(
  queryClient: QueryClient,
  device: ReceiveDevice,
  queryKey: QueryKey,
  server: () => Promise<T>,
  pick: (view: ReceiveCatalogView) => T,
  staleTime: number,
) {
  return deviceQuery({
    queryKey: [
      ...queryKey,
      { facilityId: device.stock.facilityId, programId: device.stock.programId },
    ],
    online: device.online,
    server,
    device: async () => pick(await queryClient.fetchQuery(receiveCatalogOptions(device))),
    staleTime,
  });
}

export const receiveApprovedProductsOptions = (
  queryClient: QueryClient,
  filter: EventStockCardsFilter,
  name: string,
  page: number,
  device: ReceiveDevice,
) => {
  const params = { ...filter, name, page, size: APPROVED_PRODUCTS_PAGE_SIZE };
  return receiveQuery(
    queryClient,
    device,
    approvedProductsOptions(params).queryKey,
    () => fetchApprovedProducts(params),
    (view) => catalogApprovedPage(view, name, page, APPROVED_PRODUCTS_PAGE_SIZE),
    30_000,
  );
};

export const receiveFulfilsOptions = (
  queryClient: QueryClient,
  filter: EventStockCardsFilter,
  device: ReceiveDevice,
) =>
  receiveQuery(
    queryClient,
    device,
    facilityOrderableFulfillsOptions(filter).queryKey,
    () => fetchFacilityOrderableFulfills(filter),
    (view) => view.fulfils,
    LOOKUP_STALE_TIME,
  );

export const receiveOrderablesOptions = (
  queryClient: QueryClient,
  ids: readonly string[],
  device: ReceiveDevice,
) =>
  receiveQuery(
    queryClient,
    device,
    orderablesByIdsOptions(ids).queryKey,
    () => fetchOrderablesByIds(ids),
    (view) => catalogOrderables(view, ids),
    LOOKUP_STALE_TIME,
  );

export const receiveLotsOptions = (
  queryClient: QueryClient,
  tradeItemIds: readonly string[],
  device: ReceiveDevice,
) =>
  receiveQuery(
    queryClient,
    device,
    lotsByTradeItemsOptions(tradeItemIds).queryKey,
    () => fetchLotsByTradeItems(tradeItemIds),
    (view) => catalogLots(view, tradeItemIds),
    30_000,
  );

export const receiveStockOnHandOptions = (
  queryClient: QueryClient,
  filter: EventStockOnHandFilter,
  device: ReceiveDevice,
) =>
  receiveQuery(
    queryClient,
    device,
    eventStockOnHandOptions(filter).queryKey,
    () => fetchEventStockOnHand(filter),
    (view) => catalogStock(view, filter.orderableIds),
    0,
  );

export async function fetchReceiveTradeItem(
  queryClient: QueryClient,
  device: ReceiveDevice,
  gtin: string,
) {
  return onlineOrDevice(
    async () => ({
      tradeItem: await queryClient.fetchQuery(tradeItemByGtinOptions(gtin)),
      offline: false,
    }),
    async () => {
      const view = await queryClient.fetchQuery(receiveCatalogOptions(device));
      if (!view.scanning) throw new LocalDataUnavailableError();
      return {
        tradeItem: view.tradeItems.find((item) => item.gtin === gtin) ?? null,
        offline: true,
      };
    },
  );
}

export const deviceNewLotsOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.stockEvents.all, 'device-new-lots'] as const,
    queryFn: readDeviceNewLots,
    networkMode: 'always',
    staleTime: 0,
  });
