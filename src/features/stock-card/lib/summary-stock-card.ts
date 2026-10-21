import type { Facility, LotSummary, Orderable, Program } from '@/features/reference-data/lib/types';
import type { StockCard } from '@/features/stock-card/lib/types';
import type { DeviceSnapshot } from '@/lib/local-data';

type Summary = {
  id: string;
  orderable: Orderable;
  lot: LotSummary | null;
  stockOnHand: number | null;
  active: boolean;
};
export function summaryStockCard(
  card: Summary,
  home: Facility,
  program: Program,
  device: DeviceSnapshot,
  history?: StockCard,
): StockCard {
  if (history?.device && history.device.fetchedAt >= device.fetchedAt) return history;
  return {
    id: card.id,
    facility: { ...home, name: home.name ?? home.code },
    program: { ...program, name: program.name ?? program.code },
    orderable: {
      ...card.orderable,
      fullProductName: card.orderable.fullProductName ?? card.orderable.productCode,
    },
    lot: card.lot,
    stockOnHand: card.stockOnHand,
    active: card.active,
    lineItems: [],
    summaryOnly: true,
    device,
  };
}
