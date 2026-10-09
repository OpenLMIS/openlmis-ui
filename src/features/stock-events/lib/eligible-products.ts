import type { LotSummary, Orderable, OrderableFulfills } from '@/features/reference-data/lib/types';
import { inventoryLineKey } from '@/features/stock-events/lib/physical-inventory-lines';
import type {
  InventoryStockLine,
  InventorySummary,
} from '@/features/stock-events/lib/physical-inventory-types';

export function buildEligibleProducts(
  summaries: readonly InventorySummary[],
  fulfills: OrderableFulfills,
  products: readonly Orderable[],
  lots: readonly LotSummary[],
): InventoryStockLine[] {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const lotMap = new Map(lots.map((lot) => [lot.id, lot]));
  const lotsByTradeItem = new Map<string, LotSummary[]>();
  for (const lot of lots) {
    if (!lot.tradeItemId) continue;
    const key = lot.tradeItemId.toLowerCase();
    const group = lotsByTradeItem.get(key) ?? [];
    group.push(lot);
    lotsByTradeItem.set(key, group);
  }
  const lines = new Map<string, InventoryStockLine>();
  for (const summary of summaries) {
    for (const card of summary.canFulfillForMe) {
      const line = stockLineFromCard(card, productMap, lotMap);
      lines.set(inventoryLineKey(line.orderable.id, line.lot?.id), line);
    }
    for (const id of [
      ...(fulfills[summary.orderable.id]?.canFulfillForMe ?? []),
      summary.orderable.id,
    ]) {
      const orderable = productMap.get(id);
      if (!orderable) throw new Error(`Missing product ${id}`);
      const tradeItem = orderable.identifiers?.tradeItem?.toLowerCase();
      for (const lot of [...(tradeItem ? (lotsByTradeItem.get(tradeItem) ?? []) : []), null]) {
        const key = inventoryLineKey(id, lot?.id);
        if (!lines.has(key))
          lines.set(key, { orderable, lot, stockOnHand: null, stockCardId: null });
      }
    }
  }
  return [...lines.values()];
}

export function stockLineFromCard(
  card: InventorySummary['canFulfillForMe'][number],
  products: ReadonlyMap<string, Orderable>,
  lots: ReadonlyMap<string, LotSummary>,
): InventoryStockLine {
  const orderable = products.get(card.orderable.id);
  if (!orderable) throw new Error(`Missing product ${card.orderable.id}`);
  const lot = card.lot ? lots.get(card.lot.id) : null;
  if (card.lot && !lot) throw new Error(`Missing lot ${card.lot.id}`);
  return {
    orderable,
    lot: lot ?? null,
    stockOnHand: card.stockOnHand,
    stockCardId: card.stockCard?.id ?? null,
    active: card.active,
  };
}
