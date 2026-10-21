import { fetchStockCard } from '@/features/stock-card/api/api';
import { saveStockCardHistory } from '@/features/stock-card/lib/history-cache';
import type { StockCard } from '@/features/stock-card/lib/types';
import { deviceQuery } from '@/lib/device-query';
import { queryKeys } from '@/lib/key-factory';
import { reportCaughtError } from '@/lib/report-error';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { HomeStockAccess } from '@/lib/stock-programs';

async function fetchViewedStockCard(id: string, access?: () => Promise<HomeStockAccess>) {
  const scope = getSessionScope();
  const card = await fetchStockCard(id);
  assertSessionScope(scope);
  try {
    const verifiedAccess = access ? await access() : undefined;
    assertSessionScope(scope);
    await saveStockCardHistory(card, verifiedAccess);
  } catch (error) {
    assertSessionScope(scope);
    reportCaughtError(error, {});
  }
  assertSessionScope(scope);
  return card;
}

export const stockCardOptions = (
  id: string,
  device: ((id: string) => Promise<StockCard>) | undefined,
  online: boolean,
  access?: () => Promise<HomeStockAccess>,
) =>
  deviceQuery({
    queryKey: queryKeys.stockCards.detail(id),
    online,
    server: () => fetchViewedStockCard(id, access),
    device: device ? () => device(id) : undefined,
    staleTime: 30_000,
  });
