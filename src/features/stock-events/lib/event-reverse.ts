import type {
  EventStockOnHand,
  StockEventCancel,
  StockEventCancelLineError,
  StockEventLine,
  StockEventLineReason,
} from '@/features/stock-events/lib/types';

type ReverseLineDraft = { reasonId: string; comments: string };
export type ReverseDraft = { lines: Record<string, ReverseLineDraft> };
export type ReverseRowMarks = {
  reason?: 'stock-events.required';
  stock?: 'stock-event-reverse.negative-stock';
  comments?: 'stock-events.comments-too-long';
};
export type ReverseRow = ReverseLineDraft & {
  line: StockEventLine;
};
type ReverseValidation = {
  valid: boolean;
  message?:
    | 'stock-event-reverse.none-selected'
    | 'stock-event-reverse.reason-required'
    | 'stock-event-reverse.negative-stock'
    | 'stock-events.comments-too-long';
  marks: Record<string, ReverseRowMarks>;
};

export function reverseRowId(line: StockEventLine, index: number): string {
  return line.stockEventLineItemId ?? String(index);
}

export function canReverseLine(line: StockEventLine): boolean {
  return (
    !line.cancellationEventId &&
    Boolean(
      line.source ||
        line.destination ||
        (line.reason?.reasonCategory === 'ADJUSTMENT' &&
          !line.reason.tags.includes('cancelMovement') &&
          !line.reason.tags.includes('cancelAdjustment')),
    )
  );
}

export function reversalReasonType(line: StockEventLine): 'CREDIT' | 'DEBIT' | undefined {
  if (line.destination) return 'CREDIT';
  if (line.source) return 'DEBIT';
  if (!line.reason) return undefined;
  return line.reason.reasonType === 'DEBIT' ? 'CREDIT' : 'DEBIT';
}

export function cancellationReasons(
  line: StockEventLine,
  reasons: readonly StockEventLineReason[],
): StockEventLineReason[] {
  const tag = line.source || line.destination ? 'cancelMovement' : 'cancelAdjustment';
  const type = reversalReasonType(line);
  return reasons.filter(
    (reason) =>
      reason.reasonCategory === 'ADJUSTMENT' &&
      reason.tags.includes(tag) &&
      reason.reasonType === type,
  );
}

export function stockKey(orderableId: string, lotId?: string | null): string {
  return `${orderableId}/${lotId ?? ''}`;
}

export function currentStockOnHand(line: StockEventLine, current: EventStockOnHand): number {
  return current[stockKey(line.orderable.id, line.lot?.id)] ?? line.stockOnHand;
}

export function newStockOnHand(
  lines: readonly StockEventLine[],
  tickedIds: ReadonlySet<string>,
  current: EventStockOnHand,
): Record<string, number> {
  const earlierChanges = new Map<string, number[]>();
  const result: Record<string, number> = {};
  lines.forEach((line, index) => {
    const id = reverseRowId(line, index);
    const type = reversalReasonType(line);
    if (!tickedIds.has(id) || !type) return;
    const key = stockKey(line.orderable.id, line.lot?.id);
    const base = currentStockOnHand(line, current);
    const changes = earlierChanges.get(key) ?? [];
    const previous = changes.reduce((stock, change) => stock + change, base);
    const change = type === 'CREDIT' ? line.quantity : -line.quantity;
    result[id] = previous + change;
    changes.push(change);
    earlierChanges.set(key, changes);
  });
  return result;
}

export function validateReverse(
  lines: readonly StockEventLine[],
  draft: ReverseDraft,
  current: EventStockOnHand,
): ReverseValidation {
  const ids = new Set(Object.keys(draft.lines));
  if (!ids.size) return { valid: false, message: 'stock-event-reverse.none-selected', marks: {} };
  const balances = newStockOnHand(lines, ids, current);
  const marks: Record<string, ReverseRowMarks> = {};
  let missingReason = false;
  let negativeStock = false;
  let longComments = false;
  for (const [id, row] of Object.entries(draft.lines)) {
    const mark: ReverseRowMarks = {};
    if (!row.reasonId) {
      mark.reason = 'stock-events.required';
      missingReason = true;
    }
    if (balances[id] < 0) {
      mark.stock = 'stock-event-reverse.negative-stock';
      negativeStock = true;
    }
    if (row.comments.length > 255) {
      mark.comments = 'stock-events.comments-too-long';
      longComments = true;
    }
    if (Object.keys(mark).length) marks[id] = mark;
  }
  const message = missingReason
    ? 'stock-event-reverse.reason-required'
    : negativeStock
      ? 'stock-event-reverse.negative-stock'
      : longComments
        ? 'stock-events.comments-too-long'
        : undefined;
  return { valid: !message, ...(message && { message }), marks };
}

export function liveReverseMarks(
  marks: Record<string, ReverseRowMarks>,
  draft: ReverseDraft,
  balances: Record<string, number>,
): Record<string, ReverseRowMarks> {
  let changed = false;
  const live: Record<string, ReverseRowMarks> = {};
  for (const [id, mark] of Object.entries(marks)) {
    const row = draft.lines[id];
    const kept: ReverseRowMarks = {
      ...(mark.reason && row && !row.reasonId && { reason: mark.reason }),
      ...(mark.stock && row && balances[id] < 0 && { stock: mark.stock }),
      ...(mark.comments && row && row.comments.length > 255 && { comments: mark.comments }),
    };
    if (Object.keys(kept).length !== Object.keys(mark).length) changed = true;
    if (Object.keys(kept).length) live[id] = kept;
  }
  return changed ? live : marks;
}

export function reversePayload(rows: readonly ReverseRow[], signature: string): StockEventCancel {
  return {
    signature,
    lineItems: rows.map(({ line, reasonId, comments }) => ({
      stockEventLineItemId: line.stockEventLineItemId,
      reasonId,
      ...(comments.trim() && { reasonFreeText: comments }),
    })),
  };
}

export function lineErrorMessage(error: Pick<StockEventCancelLineError, 'messageKey' | 'message'>):
  | {
      key:
        | 'stock-event-reverse.reason-required'
        | 'stock-event-reverse.reason-invalid'
        | 'stock-event-reverse.failed-description';
    }
  | { message: string } {
  if (error.messageKey === 'stockmanagement.error.event.cancellation.reason.required') {
    return { key: 'stock-event-reverse.reason-required' };
  }
  if (error.messageKey === 'stockmanagement.error.event.cancellation.reason.invalid') {
    return { key: 'stock-event-reverse.reason-invalid' };
  }
  return error.message
    ? { message: error.message }
    : { key: 'stock-event-reverse.failed-description' };
}
