import { latestOrderableVersions } from '@/features/reference-data/lib/latest-orderable-versions';
import type { LotSummary, Orderable } from '@/features/reference-data/lib/types';
import type { StockCardSummariesQuery, StockCardSummary } from '@/features/stock-on-hand/lib/types';
import { pageLocally } from '@/lib/table-search';

export function projectStockSummaries(
  sourceSummaries: StockCardSummary[],
  sourceProducts: Orderable[],
  lots: LotSummary[],
  query: StockCardSummariesQuery,
) {
  const latestProducts = latestOrderableVersions(sourceProducts);
  const products = new Map(latestProducts.map((product) => [product.id, product]));
  const byLot = new Map(lots.map((lot) => [lot.id, lot]));
  const matches = (value: string | null | undefined, filter: string | undefined) =>
    !filter || (value ?? '').toLocaleLowerCase().includes(filter.toLocaleLowerCase());
  const summaries = sourceSummaries.flatMap((summary) => {
    const product = products.get(summary.orderable.id);
    if (
      !matches(product?.fullProductName, query.orderableName) ||
      !matches(product?.productCode, query.orderableCode)
    )
      return [];
    const entries = summary.canFulfillForMe.filter((entry) =>
      matches(entry.lot ? byLot.get(entry.lot.id)?.lotCode : undefined, query.lotCode),
    );
    const balances = entries.flatMap((entry) =>
      entry.stockOnHand === null ? [] : [entry.stockOnHand],
    );
    const stockOnHand = balances.length
      ? balances.reduce((total, value) => total + value, 0)
      : null;
    return entries.length
      ? [
          {
            ...summary,
            stockOnHand: query.lotCode ? stockOnHand : summary.stockOnHand,
            canFulfillForMe: entries,
          },
        ]
      : [];
  });
  return {
    ...pageLocally(summaries, query.page, query.size),
    products: latestProducts,
    lots,
  };
}
