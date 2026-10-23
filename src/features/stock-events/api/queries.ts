import { type QueryClient, queryOptions } from '@tanstack/react-query';
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
import type {
  ApprovedProduct,
  LotSummary,
  Orderable,
  OrderableFulfills,
} from '@/features/reference-data/lib/types';
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
import {
  type ReceiveCatalogFilter,
  readReceiveCatalog,
} from '@/features/stock-events/lib/receive-catalog';
import {
  catalogApprovedPage,
  catalogLots,
  catalogOrderables,
  catalogStock,
  receiveCatalogView,
} from '@/features/stock-events/lib/receive-catalog-view';
import type {
  EventStockCardsFilter,
  EventStockOnHand,
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
import type { Page } from '@/lib/types';

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

type ReceiveQuery<T> = ReturnType<typeof deviceQuery<T>>;

export type ReceiveDevice = {
  catalog: ReceiveCatalogFilter;
  stock: HomeStockScope;
  online: boolean;
};

export const receiveDevice = (
  filter: EventStockCardsFilter,
  facilityTypeId: string,
  online: boolean,
): ReceiveDevice => ({
  catalog: { ...filter, facilityTypeId },
  stock: homeStockScope(filter, facilityTypeId),
  online,
});

export const receiveCatalogOptions = (device: Pick<ReceiveDevice, 'catalog' | 'stock'>) =>
  queryOptions({
    queryKey: [...homeStockBundleKeys.cards(device.stock), 'receive-catalog'] as const,
    queryFn: async () =>
      receiveCatalogView(
        await readReceiveCatalog(device.catalog),
        await readHomeStockBundle(device.stock),
      ),
    staleTime: 60_000,
    networkMode: 'always',
  });

export const receiveApprovedProductsOptions = (
  queryClient: QueryClient,
  filter: EventStockCardsFilter,
  name: string,
  page: number,
  device?: ReceiveDevice,
): ReceiveQuery<Page<ApprovedProduct>> => {
  const options = eventApprovedProductsOptions(filter, name, page);
  if (!device) return options as ReceiveQuery<Page<ApprovedProduct>>;
  return deviceQuery({
    queryKey: options.queryKey,
    online: device.online,
    server: () =>
      fetchApprovedProducts({ ...filter, name, page, size: APPROVED_PRODUCTS_PAGE_SIZE }),
    device: async () =>
      catalogApprovedPage(
        await queryClient.fetchQuery(receiveCatalogOptions(device)),
        name,
        page,
        APPROVED_PRODUCTS_PAGE_SIZE,
      ),
    staleTime: 0,
  });
};

export const receiveFulfilsOptions = (
  queryClient: QueryClient,
  filter: EventStockCardsFilter,
  device?: ReceiveDevice,
): ReceiveQuery<OrderableFulfills> => {
  const options = facilityOrderableFulfillsOptions(filter);
  if (!device) return options as ReceiveQuery<OrderableFulfills>;
  return deviceQuery({
    queryKey: options.queryKey,
    online: device.online,
    server: () => fetchFacilityOrderableFulfills(filter),
    device: async () => (await queryClient.fetchQuery(receiveCatalogOptions(device))).fulfils,
    staleTime: LOOKUP_STALE_TIME,
  });
};

export const receiveOrderablesOptions = (
  queryClient: QueryClient,
  ids: readonly string[],
  device?: ReceiveDevice,
): ReceiveQuery<Orderable[]> => {
  const options = orderablesByIdsOptions(ids);
  if (!device) return options as ReceiveQuery<Orderable[]>;
  return deviceQuery({
    queryKey: options.queryKey,
    online: device.online,
    server: () => fetchOrderablesByIds(ids),
    device: async () =>
      catalogOrderables(await queryClient.fetchQuery(receiveCatalogOptions(device)), ids),
    staleTime: LOOKUP_STALE_TIME,
  });
};

export const receiveLotsOptions = (
  queryClient: QueryClient,
  tradeItemIds: readonly string[],
  device?: ReceiveDevice,
): ReceiveQuery<LotSummary[]> => {
  const options = lotsByTradeItemsOptions(tradeItemIds);
  if (!device) return options as ReceiveQuery<LotSummary[]>;
  return deviceQuery({
    queryKey: options.queryKey,
    online: device.online,
    server: () => fetchLotsByTradeItems(tradeItemIds),
    device: async () =>
      catalogLots(await queryClient.fetchQuery(receiveCatalogOptions(device)), tradeItemIds),
    staleTime: 0,
  });
};

export const receiveStockOnHandOptions = (
  queryClient: QueryClient,
  filter: EventStockOnHandFilter,
  device?: ReceiveDevice,
): ReceiveQuery<EventStockOnHand> => {
  const options = eventStockOnHandOptions(filter);
  if (!device) return options as ReceiveQuery<EventStockOnHand>;
  return deviceQuery({
    queryKey: options.queryKey,
    online: device.online,
    server: () => fetchEventStockOnHand(filter),
    device: async () =>
      catalogStock(
        await queryClient.fetchQuery(receiveCatalogOptions(device)),
        filter.orderableIds,
      ),
    staleTime: 0,
  });
};

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
