import type { QueryClient } from '@tanstack/react-query';
import {
  approvedProductsOptions,
  lotsByTradeItemsOptions,
  orderableFulfillsOptions,
  orderablesByTradeItemsOptions,
} from '@/features/reference-data/api/queries';
import type { Orderable } from '@/features/reference-data/lib/types';
import {
  eventStockOnHandOptions,
  type ReceiveDevice,
  receiveCatalogOptions,
} from '@/features/stock-events/api/queries';
import { receiveLotOptions } from '@/features/stock-events/lib/products';
import {
  catalogLots,
  catalogScanCandidates,
  catalogStock,
} from '@/features/stock-events/lib/receive-catalog-view';
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
  const lotsRequest = queryClient.fetchQuery(lotsByTradeItemsOptions([tradeItemId]));
  lotsRequest.catch(() => undefined);
  const orderables = await queryClient.fetchQuery(orderablesByTradeItemsOptions([tradeItemId]));
  if (stale()) return STALE;
  const approved = await approvedAmong(orderables.map(({ id }) => id));
  if (stale()) return STALE;
  const candidates: { orderable: Orderable; approvedId: string }[] = orderables
    .filter(({ id }) => approved.has(id))
    .map((orderable) => ({ orderable, approvedId: orderable.id }));
  const others = orderables.filter(({ id }) => !approved.has(id));
  if (others.length) {
    const fulfils = await queryClient.fetchQuery(
      orderableFulfillsOptions(others.map(({ id }) => id)),
    );
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
    lotsRequest,
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

export async function catalogScanProduct(
  queryClient: QueryClient,
  device: ReceiveDevice,
  tradeItemId: string,
): Promise<ApprovedScanProduct> {
  const view = await queryClient.fetchQuery(receiveCatalogOptions(device));
  const candidates = catalogScanCandidates(view, tradeItemId);
  if (!candidates.length) return { type: 'refuse', reason: 'productNotInProgram' };
  if (candidates.length > 1) return { type: 'refuse', reason: 'productAmbiguous' };
  const [candidate] = candidates;
  const lots = catalogLots(view, [tradeItemId]);
  return {
    type: 'found',
    product: {
      orderable: candidate.orderable,
      cards: receiveLotOptions(
        candidate,
        lots,
        catalogStock(view, [candidate.approvedId]),
        false,
      ).flatMap((option) => (option.card ? [option.card] : [])),
    },
    productHasLots: lots.length > 0,
  };
}
