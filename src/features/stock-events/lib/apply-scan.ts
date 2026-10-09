import { quantityValue } from '@/components/form/quantity-value';
import {
  type EventLine,
  type EventSchemaOptions,
  newEventLine,
} from '@/features/stock-events/lib/event-form';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import type { ScanResolution } from '@/lib/stock-scan';
import { toLatinDigits, toWholeNumber } from '@/lib/whole-number';

export type ScanCountDefaults = Pick<EventSchemaOptions, 'kind'> &
  Partial<Omit<EventSchemaOptions, 'kind' | 'today'>> & {
    today: string;
    previousLine?: EventLine;
  };

function onePack(netContent: number | null | undefined): number {
  return netContent && Number.isFinite(netContent) && netContent > 0 ? netContent : 1;
}

function countLine(line: EventLine): EventLine {
  const text = toLatinDigits(line.quantity.doses.trim());
  const value =
    /^[0-9]+$/.test(text) && Number.isSafeInteger(toWholeNumber(text)) ? toWholeNumber(text) : 0;
  return {
    ...line,
    quantity: quantityValue(String(value + onePack(line.netContent)), line.netContent),
  };
}

export function applyScanCount(
  lines: readonly EventLine[],
  resolution: ScanResolution<EventStockCard>,
  { today, previousLine = lines[0], ...options }: ScanCountDefaults,
): EventLine[] {
  if (resolution.type === 'add') {
    return [countLine(newEventLine(resolution.card, previousLine, today, options)), ...lines];
  }
  if (resolution.type === 'count') {
    return lines.map((line) => (line.key === resolution.lineKey ? countLine(line) : line));
  }
  return [...lines];
}
