import { queryOptions } from '@tanstack/react-query';
import { fetchStockCard } from '@/features/stock-card/api/api';
import type { StockCard } from '@/features/stock-card/lib/types';
import { queryKeys } from '@/lib/key-factory';
import { offlineAccessQuery, withDeviceData } from '@/lib/offline-access';
import { isOnline } from '@/lib/online';

export const stockCardOptions = (id: string, device?: (id: string) => Promise<StockCard>) =>
  queryOptions({
    queryKey:
      device && !isOnline()
        ? ([...queryKeys.stockCards.detail(id), 'device'] as const)
        : queryKeys.stockCards.detail(id),
    queryFn: () =>
      device
        ? withDeviceData(
            () => fetchStockCard(id),
            () => device(id),
          )
        : fetchStockCard(id),
    ...offlineAccessQuery(30_000),
  });
