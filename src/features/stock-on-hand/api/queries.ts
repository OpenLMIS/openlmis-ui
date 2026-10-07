import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { lotsByIdsOptions, orderablesByIdsOptions } from '@/features/reference-data/api/queries';
import { fetchStockCardSummaries } from '@/features/stock-on-hand/api/api';
import { summaryIds } from '@/features/stock-on-hand/lib/stock-groups';
import type { StockCardSummariesQuery } from '@/features/stock-on-hand/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const stockCardSummariesOptions = (query: StockCardSummariesQuery) =>
  queryOptions({
    queryKey: queryKeys.stockCardSummaries.list(query),
    queryFn: () => fetchStockCardSummaries(query),
  });

/** Starts the page of stock, then its product and lot names as soon as it arrives; failures show in the list. */
export function prefetchStockOnHand(queryClient: QueryClient, query: StockCardSummariesQuery) {
  const options = stockCardSummariesOptions(query);
  queryClient.fetchQuery(options).then(
    (page) => {
      if (!queryClient.getQueryCache().find({ queryKey: options.queryKey })) return;
      const ids = summaryIds(page.content);
      queryClient.prefetchQuery(orderablesByIdsOptions(ids.orderableIds));
      queryClient.prefetchQuery(lotsByIdsOptions(ids.lotIds));
    },
    () => {},
  );
}
