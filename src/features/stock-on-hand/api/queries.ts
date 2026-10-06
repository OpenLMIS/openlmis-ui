import { queryOptions } from '@tanstack/react-query';
import { fetchStockCardSummaries } from '@/features/stock-on-hand/api/api';
import type { StockCardSummariesQuery } from '@/features/stock-on-hand/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const stockCardSummariesOptions = (query: StockCardSummariesQuery) =>
  queryOptions({
    queryKey: queryKeys.stockCardSummaries.list(query),
    queryFn: () => fetchStockCardSummaries(query),
  });
