import type { Reason } from '@/features/reference-data/lib/types';
import type { AdjustmentLine } from '@/features/stock-events/lib/adjustment-form';

export type LineDateFormatter = (value: string) => string;

export function filterAdjustmentLines(
  lines: readonly AdjustmentLine[],
  keyword: string,
  reasons: readonly Pick<Reason, 'id' | 'name'>[],
  formatDate: LineDateFormatter,
): AdjustmentLine[] {
  const query = keyword.trim().toLowerCase();
  if (!query) return [...lines];
  const reasonNames = new Map(reasons.map((reason) => [reason.id, reason.name]));
  return lines.filter((line) => {
    const { orderable, lot } = line;
    const name = orderable.fullProductName || orderable.productCode;
    const unit = orderable.dispensable?.displayUnit;
    const fields = [
      orderable.productCode,
      unit ? `${name} - ${unit}` : name,
      String(line.stockOnHand),
      reasonNames.get(line.reasonId),
      line.reasonFreeText,
      line.quantity.doses,
      lot?.lotCode,
      lot?.expirationDate ? formatDate(lot.expirationDate) : '',
      line.occurredDate ? formatDate(line.occurredDate) : '',
    ];
    return fields.some((value) => value?.toLowerCase().includes(query));
  });
}

export function pageOf(index: number, size: number): number {
  return Math.floor(index / size) + 1;
}
