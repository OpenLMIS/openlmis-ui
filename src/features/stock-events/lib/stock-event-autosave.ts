import type { EventLine } from '@/features/stock-events/lib/event-form';
import {
  archiveStockEventCopy,
  DraftConflictError,
  readStockEventDraft,
  restoreStockEventCopy,
  type StockEventContext,
  type StockEventDraft,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import {
  enqueueStockEvent,
  type QueuedStockEvent,
  type StockEventDisplay,
} from '@/features/stock-events/lib/stock-event-queue';
import type { StockEvent } from '@/features/stock-events/lib/types';
import { assertSessionScope } from '@/lib/session-scope';

export type StockEventSaveState = {
  status: 'loading' | 'saving' | 'saved' | 'failed' | 'conflict';
  error?: unknown;
};
export function createStockEventWriter(
  context: StockEventContext,
  initial: StockEventDraft | undefined,
  onStatus: (state: StockEventSaveState) => void,
  generation?: () => string | undefined,
) {
  let expected = initial;
  let latest: EventLine[] | undefined;
  let current = initial?.lines ?? [];
  let running: Promise<void> | undefined;
  let stopped = false;
  let conflict = false;
  let frozen = false;
  let submitting: Promise<QueuedStockEvent> | undefined;
  function fail(error: unknown, alreadyConflicted = false) {
    stopped = true;
    conflict = alreadyConflicted || error instanceof DraftConflictError;
    onStatus({ status: conflict ? 'conflict' : 'failed', error });
  }
  async function drain() {
    while (latest && !stopped) {
      const next = latest;
      latest = undefined;
      try {
        expected = await saveStockEventDraft(context, expected, next, generation?.());
        if (!latest) onStatus({ status: 'saved' });
      } catch (error) {
        latest ??= next;
        fail(error);
      }
    }
  }
  function start() {
    running ??= drain().finally(() => {
      running = undefined;
      if (latest && !stopped) start();
    });
  }
  function stage(lines: EventLine[]) {
    if (frozen || submitting) return;
    current = lines;
    latest = lines;
    if (!stopped) onStatus({ status: 'saving' });
  }
  return {
    stage,
    start: () => {
      if (!stopped && latest) start();
    },
    enqueue(lines: EventLine[]) {
      stage(lines);
      if (!stopped) start();
    },
    async flush() {
      if (!stopped && latest) start();
      await running;
      return !stopped;
    },
    retry() {
      if (conflict) return;
      stopped = false;
      conflict = false;
      onStatus({ status: 'saving' });
      start();
    },
    async replace(lines: EventLine[]) {
      if (frozen || submitting) return false;
      await running;
      if (conflict) return false;
      latest = lines;
      stopped = false;
      conflict = false;
      onStatus({ status: 'saving' });
      start();
      await running;
      if (!stopped) current = lines;
      else latest = current;
      return !stopped;
    },
    submit(payload: StockEvent, display: StockEventDisplay) {
      submitting ??= (async () => {
        if (!(await this.flush()) || !expected) throw new Error('The draft is not saved');
        try {
          const queued = await enqueueStockEvent(context, expected, payload, display);
          frozen = true;
          latest = undefined;
          return queued;
        } catch (error) {
          latest ??= current;
          fail(error, conflict);
          throw error;
        }
      })().finally(() => {
        if (!frozen) submitting = undefined;
      });
      return submitting;
    },
    async restore(copy: StockEventDraft) {
      if (frozen || submitting) return undefined;
      if (!(await this.flush())) return undefined;
      try {
        expected = await restoreStockEventCopy(context, expected, copy);
        current = expected.lines;
        latest = undefined;
        onStatus({ status: 'saved' });
        return expected;
      } catch (error) {
        fail(error);
        return undefined;
      }
    },
    async discard() {
      if (frozen || submitting) return false;
      await running;
      try {
        expected = await saveStockEventDraft(context, expected, []);
        current = [];
        latest = undefined;
        stopped = false;
        conflict = false;
        onStatus({ status: 'saved' });
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
    },
    async resolve(choice: 'load' | 'copy') {
      if (frozen || submitting) return expected;
      await running;
      assertSessionScope(context.sessionScope);
      const stored = await context.db.transaction('rw', 'stockEventDrafts', async () => {
        if (choice === 'copy')
          await archiveStockEventCopy(
            context,
            current,
            generation?.() ?? expected?.downloadGeneration,
          );
        assertSessionScope(context.sessionScope);
        return readStockEventDraft(context);
      });
      assertSessionScope(context.sessionScope);
      expected = stored;
      current = stored?.lines ?? [];
      latest = undefined;
      stopped = false;
      conflict = false;
      onStatus({ status: 'saved' });
      return stored;
    },
  };
}
