import type { QueryClient } from '@tanstack/react-query';
import { fetchOrderableFulfills } from '@/features/reference-data/api/api';
import {
  approvedProductsOptions,
  lotsByTradeItemsOptions,
  orderablesByTradeItemsOptions,
} from '@/features/reference-data/api/queries';
import type { Orderable } from '@/features/reference-data/lib/types';
import { eventStockOnHandOptions } from '@/features/stock-events/api/queries';
import { receiveLotOptions } from '@/features/stock-events/lib/products';
import type { EventStockCard, EventStockCardsFilter } from '@/features/stock-events/lib/types';
import type { ScanProduct } from '@/lib/stock-scan';

export type ApprovedScanProduct =
  | { type: 'stale' }
  | { type: 'refuse'; reason: 'productNotInProgram' | 'productAmbiguous' }
  | { type: 'found'; product: ScanProduct<EventStockCard>; productHasLots: boolean };

const STALE = { type: 'stale' } as const;

export async function approvedScanProduct(
  queryClient: QueryClient,
  filter: EventStockCardsFilter,
  tradeItemId: string,
  stale: () => boolean,
): Promise<ApprovedScanProduct> {
  const approvedAmong = async (ids: readonly string[]) => {
    if (!ids.length) return new Set<string>();
    const page = await queryClient.fetchQuery(
      approvedProductsOptions({ ...filter, orderableIds: ids, page: 0, size: ids.length }),
    );
    return new Set(page.content.map(({ orderable }) => orderable.id));
  };
  const orderables = await queryClient.fetchQuery(orderablesByTradeItemsOptions([tradeItemId]));
  if (stale()) return STALE;
  const approved = await approvedAmong(orderables.map(({ id }) => id));
  if (stale()) return STALE;
  const candidates: { orderable: Orderable; approvedId: string }[] = orderables
    .filter(({ id }) => approved.has(id))
    .map((orderable) => ({ orderable, approvedId: orderable.id }));
  const others = orderables.filter(({ id }) => !approved.has(id));
  if (others.length) {
    const fulfils = await fetchOrderableFulfills(others.map(({ id }) => id));
    if (stale()) return STALE;
    const fulfilled = (id: string) => fulfils[id]?.canBeFulfilledByMe ?? [];
    const approvedFulfilled = await approvedAmong([
      ...new Set(others.flatMap(({ id }) => fulfilled(id))),
    ]);
    if (stale()) return STALE;
    for (const orderable of others) {
      const approvedId = fulfilled(orderable.id).find((id) => approvedFulfilled.has(id));
      if (approvedId) candidates.push({ orderable, approvedId });
    }
  }
  if (!candidates.length) return { type: 'refuse', reason: 'productNotInProgram' };
  if (candidates.length > 1) return { type: 'refuse', reason: 'productAmbiguous' };
  const [candidate] = candidates;
  const [lots, stock] = await Promise.all([
    queryClient.fetchQuery(lotsByTradeItemsOptions([tradeItemId])),
    queryClient.fetchQuery(
      eventStockOnHandOptions({ ...filter, orderableIds: [candidate.approvedId] }),
    ),
  ]);
  if (stale()) return STALE;
  return {
    type: 'found',
    product: {
      orderable: candidate.orderable,
      cards: receiveLotOptions(candidate, lots, stock, false).flatMap((option) =>
        option.card ? [option.card] : [],
      ),
    },
    productHasLots: lots.length > 0,
  };
}
