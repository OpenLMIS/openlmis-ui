import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { lotsByIdsOptions, orderablesByIdsOptions } from '@/features/reference-data/api/queries';
import { fetchStockCardSummaries } from '@/features/stock-on-hand/api/api';
import { summaryIds } from '@/features/stock-on-hand/lib/stock-groups';
import type {
  DeviceStockOnHandReader,
  StockCardSummariesQuery,
  StockOnHandPage,
} from '@/features/stock-on-hand/lib/types';
import { queryKeys } from '@/lib/key-factory';
import { onlineOrDevice } from '@/lib/local-data';
import { offlineAccessQuery } from '@/lib/offline-access';
import { isOnline } from '@/lib/online';

export const stockCardSummariesOptions = (
  query: StockCardSummariesQuery,
  device?: DeviceStockOnHandReader,
) =>
  queryOptions({
    queryKey: queryKeys.stockCardSummaries.list(
      device && !isOnline() ? { ...query, device: true } : query,
    ),
    queryFn: (): Promise<StockOnHandPage> =>
      device
        ? onlineOrDevice(
            () => fetchStockCardSummaries(query),
            () => device(query),
          )
        : fetchStockCardSummaries(query),
    ...offlineAccessQuery(30_000),
  });

/** Starts the page of stock, then its product and lot names as soon as it arrives; failures show in the list. */
export function prefetchStockOnHand(
  queryClient: QueryClient,
  query: StockCardSummariesQuery,
  device?: DeviceStockOnHandReader,
) {
  const options = stockCardSummariesOptions(query, device);
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
