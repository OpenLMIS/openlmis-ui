import type { Lot, LotRow } from '@/features/lots/lib/types';
import type { Orderable } from '@/features/reference-data/lib/types';

export function toLotRows(lots: readonly Lot[], orderables: readonly Orderable[]): LotRow[] {
  const byTradeItem = new Map(
    orderables.flatMap((orderable) => {
      const tradeItem = orderable.identifiers?.tradeItem;
      return tradeItem ? [[tradeItem.toLowerCase(), orderable] as const] : [];
    }),
  );
  return lots.map((lot) => ({
    ...lot,
    product: byTradeItem.get(lot.tradeItemId.toLowerCase()) ?? null,
  }));
}
