import type { CardLineRow, StockCardLine } from '@/features/stock-card/lib/types';

export function toCardLines(lines: readonly StockCardLine[]): CardLineRow[] {
  return lines.toReversed().flatMap((line) => {
    if (!line.stockAdjustments?.length) {
      return [{ ...line, rowId: line.id }];
    }
    let balance = line.stockOnHand;
    return line.stockAdjustments.toReversed().map((adjustment, index) => {
      const row = {
        ...line,
        ...adjustment,
        stockAdjustments: [],
        stockOnHand: balance,
        rowId: `${line.id}:${index}`,
      };
      balance -= adjustment.quantity * (adjustment.reason.reasonType === 'DEBIT' ? -1 : 1);
      return row;
    });
  });
}
