import type { QueryClient } from '@tanstack/react-query';
import { lotsByIdsOptions, orderablesByIdsOptions } from '@/features/reference-data/api/queries';
import { fetchStockCardSummaries } from '@/features/stock-on-hand/api/api';
import { summaryIds } from '@/features/stock-on-hand/lib/stock-groups';
import type {
  DeviceStockOnHandReader,
  StockCardSummariesQuery,
  StockOnHandPage,
} from '@/features/stock-on-hand/lib/types';
import { deviceQuery } from '@/lib/device-query';
import { homeStockBundleKeys, queryKeys } from '@/lib/key-factory';

export const stockCardSummariesOptions = (
  query: StockCardSummariesQuery,
  device: DeviceStockOnHandReader | undefined,
  online: boolean,
) =>
  deviceQuery({
    queryKey: queryKeys.stockCardSummaries.list(query),
    online,
    server: (): Promise<StockOnHandPage> => fetchStockCardSummaries(query),
    device: device ? () => device(query) : undefined,
    staleTime: 30_000,
  });

/** Starts the page of stock, then its product and lot names as soon as it arrives; failures show in the list. */
export function prefetchStockOnHand(
  queryClient: QueryClient,
  query: StockCardSummariesQuery,
  device: DeviceStockOnHandReader | undefined,
  online: boolean,
) {
  const options = stockCardSummariesOptions(query, device, online);
  queryClient.fetchQuery(options).then(
    (page) => {
      if (!queryClient.getQueryCache().find({ queryKey: options.queryKey })) return;
      if (page.device) return;
      const ids = summaryIds(page.content);
      queryClient.prefetchQuery(orderablesByIdsOptions(ids.orderableIds));
      queryClient.prefetchQuery(lotsByIdsOptions(ids.lotIds));
    },
    () => {},
  );
}

export function stockSummaryLookups(
  ids: ReturnType<typeof summaryIds>,
  device: StockOnHandPage['device'],
) {
  return [
    device
      ? {
          queryKey: homeStockBundleKeys.products(ids.orderableIds, device.generation),
          queryFn: () => Promise.resolve(device.products),
          staleTime: Number.POSITIVE_INFINITY,
        }
      : orderablesByIdsOptions(ids.orderableIds),
    device
      ? {
          queryKey: homeStockBundleKeys.lots(ids.lotIds, device.generation),
          queryFn: () => Promise.resolve(device.lots),
          staleTime: Number.POSITIVE_INFINITY,
        }
      : lotsByIdsOptions(ids.lotIds),
  ] as const;
}
