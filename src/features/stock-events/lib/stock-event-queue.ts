import { announceQueuedEvents } from '@/features/stock-events/lib/device-event-status';
import {
  foregroundStockEventIds,
  holdForegroundStockEvent,
  releaseForegroundStockEvent,
} from '@/features/stock-events/lib/stock-event-delivery';
import type {
  StockEventContext,
  StockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import { readStockEventDraft } from '@/features/stock-events/lib/stock-event-local';
import type { StockEvent } from '@/features/stock-events/lib/types';
import { LOCAL_TABLES } from '@/integrations/local-db';
import { DraftConflictError } from '@/lib/draft-store';
import type { NamedRecord } from '@/lib/facility-program-selection';
import { assertSessionScope } from '@/lib/session-scope';

export type StockEventDisplay = {
  facility: NamedRecord;
  program: NamedRecord;
  destinations?: { id: string; name: string }[];
  sources?: { id: string; name: string }[];
  stockCards?: { id: string; orderableId: string; lotId?: string | null }[];
  reasons?: { id: string; name: string }[];
};
export type QueuedStockEvent = Pick<
  StockEventDraft,
  'localEventId' | 'draftId' | 'revision' | 'kind' | 'facilityId' | 'programId' | 'userId' | 'lines'
> &
  StockEventDisplay & {
    sequence: number;
    payload: StockEvent;
    postBody: string;
    queuedAt: number;
    status: 'queued' | 'sending' | 'uncertain';
    attemptId?: string;
    attemptStartedAt?: number;
    lastFailure?: string;
    pauseReason?: 'access-changed' | 'draft-changed';
  };

export async function enqueueStockEvent(
  context: StockEventContext,
  expected: StockEventDraft,
  payload: StockEvent,
  display: StockEventDisplay,
  options: { foreground?: boolean } = {},
): Promise<QueuedStockEvent> {
  assertSessionScope(context.sessionScope);
  const drafts = context.db.table<StockEventDraft>(LOCAL_TABLES.stockEventDrafts);
  const queue = context.db.table<QueuedStockEvent, number, Omit<QueuedStockEvent, 'sequence'>>(
    LOCAL_TABLES.stockEventQueue,
  );
  if (
    expected.userId !== context.userId ||
    expected.kind !== context.kind ||
    expected.facilityId !== context.facilityId ||
    expected.programId !== context.programId
  )
    throw new DraftConflictError(undefined);
  const frozen = structuredClone(payload);
  let inserted = false;
  let completed = false;
  try {
    if (options.foreground) await holdForegroundStockEvent(expected.localEventId);
    const result = await context.db.transaction('rw', drafts, queue, async () => {
      const duplicate = await queue.where('localEventId').equals(expected.localEventId).first();
      assertSessionScope(context.sessionScope);
      if (duplicate) {
        if (
          duplicate.draftId !== expected.draftId ||
          duplicate.revision !== expected.revision ||
          duplicate.userId !== context.userId
        )
          throw new DraftConflictError(await readStockEventDraft(context));
        return duplicate;
      }
      const stored = await readStockEventDraft(context);
      if (
        !stored ||
        stored.draftId !== expected.draftId ||
        stored.revision !== expected.revision ||
        stored.userId !== context.userId ||
        stored.localEventId !== expected.localEventId
      )
        throw new DraftConflictError(stored);
      if (frozen.facilityId !== context.facilityId || frozen.programId !== context.programId)
        throw new Error('The event does not match the draft scope');
      const row: Omit<QueuedStockEvent, 'sequence'> = {
        localEventId: stored.localEventId,
        draftId: stored.draftId,
        revision: stored.revision,
        kind: stored.kind,
        facilityId: stored.facilityId,
        programId: stored.programId,
        userId: stored.userId,
        lines: structuredClone(stored.lines),
        ...structuredClone(display),
        payload: frozen,
        postBody: JSON.stringify(frozen),
        queuedAt: Date.now(),
        status: 'queued',
      };
      await drafts.put({
        ...stored,
        state: 'queued',
        signature: frozen.signature,
        updatedAt: row.queuedAt,
      });
      assertSessionScope(context.sessionScope);
      const sequence = await queue.add(row);
      assertSessionScope(context.sessionScope);
      inserted = true;
      return { ...row, sequence };
    });
    assertSessionScope(context.sessionScope);
    const foreground = await foregroundStockEventIds();
    if (inserted && !foreground.has(result.localEventId)) {
      const count = await queue
        .filter(
          (event) =>
            !foreground.has(event.localEventId) &&
            !event.pauseReason &&
            (event.status === 'queued' || event.status === 'sending'),
        )
        .count();
      assertSessionScope(context.sessionScope);
      announceQueuedEvents(count);
    }
    completed = true;
    return result;
  } finally {
    if (options.foreground && !completed) releaseForegroundStockEvent(expected.localEventId);
  }
}
