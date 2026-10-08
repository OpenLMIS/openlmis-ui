import { quantityValue } from '@/components/form/quantity-value';
import {
  type AdjustmentLine,
  newAdjustmentLine,
} from '@/features/stock-events/lib/adjustment-form';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import type { ScanResolution } from '@/lib/stock-scan';
import { toLatinDigits, toWholeNumber } from '@/lib/whole-number';

export type ScanCountDefaults = { today: string; previousLine?: AdjustmentLine };

function onePack(netContent: number | null | undefined): number {
  return netContent && Number.isFinite(netContent) && netContent > 0 ? netContent : 1;
}

function countLine(line: AdjustmentLine): AdjustmentLine {
  const text = toLatinDigits(line.quantity.doses.trim());
  const value =
    /^[0-9]+$/.test(text) && Number.isSafeInteger(toWholeNumber(text)) ? toWholeNumber(text) : 0;
  return {
    ...line,
    quantity: quantityValue(String(value + onePack(line.netContent)), line.netContent),
  };
}

export function applyScanCount(
  lines: readonly AdjustmentLine[],
  resolution: ScanResolution<EventStockCard>,
  { today, previousLine = lines[0] }: ScanCountDefaults,
): AdjustmentLine[] {
  if (resolution.type === 'add') {
    return [countLine(newAdjustmentLine(resolution.card, previousLine, today)), ...lines];
  }
  if (resolution.type === 'count') {
    return lines.map((line) => (line.key === resolution.lineKey ? countLine(line) : line));
  }
  return [...lines];
}
