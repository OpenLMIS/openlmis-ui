import type {
  ApprovedProduct,
  LotSummary,
  Orderable,
  OrderableFulfills,
  TradeItem,
} from '@/features/reference-data/lib/types';
import type { HomeStockSummary } from '@/features/stock-events/api/stock-card-reader';
import { stockKey } from '@/features/stock-events/lib/event-reverse';
import type { HomeStockBundle } from '@/features/stock-events/lib/home-stock-bundle';
import { productLabel } from '@/features/stock-events/lib/products';
import type { ReceiveCatalog } from '@/features/stock-events/lib/receive-catalog';
import type { EventStockOnHand } from '@/features/stock-events/lib/types';
import { LocalDataUnavailableError } from '@/lib/local-data';
import type { Page } from '@/lib/types';

export type ReceiveCatalogView = {
  fetchedAt: number;
  generation: string;
  scanning: boolean;
  approved: ApprovedProduct[];
  products: ReadonlyMap<string, Orderable>;
  fulfils: OrderableFulfills;
  fulfilledBy: ReadonlyMap<string, string[]>;
  lots: ReadonlyMap<string, LotSummary[]>;
  tradeItems: readonly TradeItem[];
  stock: ReadonlyMap<string, HomeStockSummary['canFulfillForMe']>;
};

export function receiveCatalogView(
  catalog: ReceiveCatalog,
  bundle: HomeStockBundle,
): ReceiveCatalogView {
  if (bundle.formatVersion !== 6 || !bundle.summaries || !bundle.products)
    throw new LocalDataUnavailableError();
  const products = new Map(catalog.products.map((product) => [product.id, product]));
  const approved = new Map(
    catalog.approved.flatMap(({ id }) => {
      const orderable = products.get(id);
      return orderable ? [[id, { id, orderable }] as const] : [];
    }),
  );
  const bundleProducts = new Map(bundle.products.map((product) => [product.id, product]));
  for (const summary of bundle.summaries) {
    if (approved.has(summary.orderable.id)) continue;
    const orderable = bundleProducts.get(summary.orderable.id);
    if (orderable) {
      approved.set(orderable.id, { id: orderable.id, orderable });
      products.set(orderable.id, orderable);
    }
  }
  const fulfilledBy = new Map<string, string[]>();
  for (const [approvedId, ids] of Object.entries(catalog.fulfils)) {
    for (const id of ids) fulfilledBy.set(id, [...(fulfilledBy.get(id) ?? []), approvedId]);
  }
  const lots = new Map<string, LotSummary[]>();
  for (const lot of [...catalog.lots, ...bundle.cards.flatMap(({ lot }) => (lot ? [lot] : []))]) {
    if (!lot.tradeItemId) continue;
    const key = lot.tradeItemId.toLowerCase();
    const group = lots.get(key) ?? [];
    if (!group.some(({ id }) => id === lot.id)) group.push(lot);
    lots.set(key, group);
  }
  return {
    fetchedAt: catalog.fetchedAt,
    generation: catalog.generation,
    scanning: catalog.scanning,
    approved: [...approved.values()].sort(
      (a, b) =>
        productLabel(a.orderable).localeCompare(productLabel(b.orderable)) ||
        a.orderable.productCode.localeCompare(b.orderable.productCode) ||
        a.id.localeCompare(b.id),
    ),
    products,
    fulfils: Object.fromEntries(
      Object.entries(catalog.fulfils).map(([id, canFulfillForMe]) => [id, { canFulfillForMe }]),
    ),
    fulfilledBy,
    lots,
    tradeItems: [
      ...new Map(
        [...catalog.tradeItems, ...bundle.tradeItems].map((item) => [item.id.toLowerCase(), item]),
      ).values(),
    ],
    stock: new Map(
      bundle.summaries.map((summary) => [summary.orderable.id, summary.canFulfillForMe]),
    ),
  };
}

export function catalogApprovedPage(
  view: ReceiveCatalogView,
  name: string,
  page: number,
  size: number,
): Page<ApprovedProduct> {
  const matches = view.approved.filter(({ orderable }) =>
    (orderable.fullProductName ?? '').toLowerCase().includes(name.toLowerCase()),
  );
  return {
    content: matches.slice(page * size, (page + 1) * size),
    totalElements: matches.length,
    totalPages: Math.ceil(matches.length / size),
    number: page,
    size,
  };
}

export function catalogOrderables(view: ReceiveCatalogView, ids: readonly string[]): Orderable[] {
  return ids.flatMap((id) => {
    const product = view.products.get(id);
    return product ? [product] : [];
  });
}

export function catalogLots(
  view: ReceiveCatalogView,
  tradeItemIds: readonly string[],
): LotSummary[] {
  return [
    ...new Map(
      tradeItemIds
        .flatMap((id) => view.lots.get(id.toLowerCase()) ?? [])
        .map((lot) => [lot.id, lot]),
    ).values(),
  ];
}

export function catalogStock(
  view: ReceiveCatalogView,
  orderableIds: readonly string[],
): EventStockOnHand {
  return Object.fromEntries(
    orderableIds.flatMap((id) =>
      (view.stock.get(id) ?? []).map((entry) => [
        stockKey(entry.orderable.id, entry.lot?.id),
        entry.stockOnHand,
      ]),
    ),
  );
}

export function catalogScanCandidates(
  view: ReceiveCatalogView,
  tradeItemId: string,
): { orderable: Orderable; approvedId: string }[] {
  const approved = new Set(view.approved.map(({ id }) => id));
  return [...view.products.values()].flatMap((orderable) => {
    if (orderable.identifiers?.tradeItem?.toLowerCase() !== tradeItemId.toLowerCase()) return [];
    const approvedId = approved.has(orderable.id)
      ? orderable.id
      : view.fulfilledBy.get(orderable.id)?.[0];
    return approvedId ? [{ orderable, approvedId }] : [];
  });
}
