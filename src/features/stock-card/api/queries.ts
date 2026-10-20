import { queryOptions } from '@tanstack/react-query';
import { fetchStockCard } from '@/features/stock-card/api/api';
import { saveStockCardHistory } from '@/features/stock-card/lib/history-cache';
import type { StockCard } from '@/features/stock-card/lib/types';
import { queryKeys } from '@/lib/key-factory';
import { onlineOrDevice } from '@/lib/local-data';
import { offlineAccessQuery } from '@/lib/offline-access';
import { isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

async function fetchViewedStockCard(id: string) {
  const scope = getSessionScope();
  const card = await fetchStockCard(id);
  assertSessionScope(scope);
  try {
    await saveStockCardHistory(card);
  } catch {
    assertSessionScope(scope);
  }
  assertSessionScope(scope);
  return card;
}

export const stockCardOptions = (id: string, device?: (id: string) => Promise<StockCard>) =>
  queryOptions({
    queryKey:
      device && !isOnline()
        ? ([...queryKeys.stockCards.detail(id), 'device'] as const)
        : queryKeys.stockCards.detail(id),
    queryFn: () =>
      device
        ? onlineOrDevice(
            () => fetchViewedStockCard(id),
            () => device(id),
          )
        : fetchViewedStockCard(id),
    ...offlineAccessQuery(30_000),
  });
