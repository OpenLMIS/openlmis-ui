import type { CardLineRow, StockCard, StockCardLine } from '@/features/stock-card/lib/types';

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

export function namedWithFreeText(
  record: { name: string } | null | undefined,
  freeText?: string | null,
) {
  if (!record) return '';
  return freeText ? `${record.name}: ${freeText}` : record.name;
}

export function reasonLabel(line: StockCardLine, physicalInventory: string) {
  if (!line.reason) return '';
  if (line.reasonFreeText) return namedWithFreeText(line.reason, line.reasonFreeText);
  return line.reason.reasonCategory === 'PHYSICAL_INVENTORY' ? physicalInventory : line.reason.name;
}

export function documentNumbers(line: StockCardLine, noNumber: string) {
  return {
    document: line.eventOrigin ? line.documentNumber || noNumber : '',
    reversing: line.reversedEventId ? line.reversedEventDocumentNumber || noNumber : '',
    reversedBy: line.cancellationEventId ? line.cancellationEventDocumentNumber || noNumber : '',
  };
}

export function stockCardProductName(
  product: Pick<StockCard['orderable'], 'fullProductName' | 'dispensable'>,
) {
  const unit = product.dispensable?.displayUnit;
  return unit ? `${product.fullProductName} - ${unit}` : product.fullProductName;
}
