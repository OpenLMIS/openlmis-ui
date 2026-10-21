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
import { homeStockBundleKeys } from '@/lib/key-factory';

export const stockCardSummariesOptions = (
  query: StockCardSummariesQuery,
  device?: DeviceStockOnHandReader,
  online = true,
) =>
  deviceQuery({
    queryKey: homeStockBundleKeys.summaries(query),
    online,
    server: (): Promise<StockOnHandPage> => fetchStockCardSummaries(query),
    device: device ? () => device(query) : undefined,
    staleTime: 30_000,
  });

/** Starts the page of stock, then its product and lot names as soon as it arrives; failures show in the list. */
export function prefetchStockOnHand(
  queryClient: QueryClient,
  query: StockCardSummariesQuery,
  device?: DeviceStockOnHandReader,
  online = true,
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

import { fetchLotsByIds, fetchOrderablesByIds } from '@/features/reference-data/api/api';

export function stockSummaryLookups(
  ids: ReturnType<typeof summaryIds>,
  device: StockOnHandPage['device'],
) {
  return [
    {
      queryKey: (device
        ? homeStockBundleKeys.products(ids.orderableIds, device.generation)
        : orderablesByIdsOptions(ids.orderableIds).queryKey) as readonly unknown[],
      queryFn: () =>
        device ? Promise.resolve(device.products) : fetchOrderablesByIds(ids.orderableIds),
      staleTime: device ? Number.POSITIVE_INFINITY : 10 * 60 * 1000,
    },
    {
      queryKey: (device
        ? homeStockBundleKeys.lots(ids.lotIds, device.generation)
        : lotsByIdsOptions(ids.lotIds).queryKey) as readonly unknown[],
      queryFn: () => (device ? Promise.resolve(device.lots) : fetchLotsByIds(ids.lotIds)),
      staleTime: device ? Number.POSITIVE_INFINITY : 10 * 60 * 1000,
    },
  ] as const;
}
