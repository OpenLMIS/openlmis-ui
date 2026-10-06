import type { LotSummary, Orderable } from '@/features/reference-data/lib/types';
import type {
  StockCardRow,
  StockCardSummary,
  StockProductGroup,
} from '@/features/stock-on-hand/lib/types';

/** The products and lots one page names, each once, for looking up their names. */
export function summaryIds(summaries: readonly StockCardSummary[]) {
  const orderableIds = new Set<string>();
  const lotIds = new Set<string>();
  for (const summary of summaries) {
    orderableIds.add(summary.orderable.id);
    for (const entry of summary.canFulfillForMe) {
      orderableIds.add(entry.orderable.id);
      if (entry.lot) lotIds.add(entry.lot.id);
    }
  }
  return { orderableIds: [...orderableIds], lotIds: [...lotIds] };
}

const lotCodeOf = (row: StockCardRow) => row.lot?.lotCode ?? '';

/** Product rows in server order, each with its cards by lot code; hidden inactive cards take an emptied product with them. */
export function toStockGroups(
  summaries: readonly StockCardSummary[],
  orderables: readonly Orderable[],
  lots: readonly LotSummary[],
  includeInactive: boolean,
): StockProductGroup[] {
  const productById = new Map(orderables.map((orderable) => [orderable.id, orderable]));
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));

  return summaries.flatMap((summary) => {
    const cards = summary.canFulfillForMe
      .filter((entry) => includeInactive || entry.active === true)
      .map(
        (entry, index): StockCardRow => ({
          id: entry.stockCard?.id ?? `${summary.orderable.id}:${index}`,
          stockCardId: entry.stockCard?.id ?? null,
          product: productById.get(entry.orderable.id),
          lot: entry.lot ? lotById.get(entry.lot.id) : null,
          stockOnHand: entry.stockOnHand,
          occurredDate: entry.occurredDate,
          active: entry.active,
        }),
      )
      .sort((a, b) => lotCodeOf(a).localeCompare(lotCodeOf(b)));
    if (cards.length === 0) return [];
    return [
      {
        id: summary.orderable.id,
        product: productById.get(summary.orderable.id),
        stockOnHand: summary.stockOnHand,
        cards,
      },
    ];
  });
}
