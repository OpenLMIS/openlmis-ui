import { queryOptions } from '@tanstack/react-query';
import { fetchStockCard } from '@/features/stock-card/api/api';
import { queryKeys } from '@/lib/key-factory';

export const stockCardOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.stockCards.detail(id),
    queryFn: () => fetchStockCard(id),
  });
