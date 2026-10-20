import type { EventLine } from '@/features/stock-events/lib/event-form';
import {
  archiveStockEventCopy,
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
import { createDraftWriter, type DraftSaveState as StockEventSaveState } from '@/lib/draft-writer';
import { assertSessionScope } from '@/lib/session-scope';

export type { DraftSaveState as StockEventSaveState } from '@/lib/draft-writer';
export function createStockEventWriter(
  context: StockEventContext,
  initial: StockEventDraft | undefined,
  onStatus: (state: StockEventSaveState) => void,
  generation?: () => string | undefined,
) {
  let expected = initial;
  let current = initial?.lines ?? [];
  let frozen = false;
  let submitting: Promise<QueuedStockEvent> | undefined;
  const serial = createDraftWriter<EventLine[]>(async (lines) => {
    expected = await saveStockEventDraft(context, expected, lines, generation?.());
  }, onStatus);
  function stage(lines: EventLine[]) {
    if (frozen || submitting) return;
    current = lines;
    serial.stage(lines);
  }
  return {
    stage,
    start: () => {
      if (!frozen && !submitting) serial.start();
    },
    enqueue(lines: EventLine[]) {
      stage(lines);
      serial.start();
    },
    flush: serial.flush,
    retry: serial.retry,
    async replace(lines: EventLine[]) {
      if (frozen || submitting) return false;
      await serial.wait();
      if (serial.conflicted) return false;
      serial.retain(lines);
      serial.retry();
      await serial.wait();
      if (!serial.stopped) current = lines;
      else serial.retain(current);
      return !serial.stopped;
    },
    submit(payload: StockEvent, display: StockEventDisplay, options?: { foreground?: boolean }) {
      submitting ??= (async () => {
        if (!(await this.flush()) || !expected) throw new Error('The draft is not saved');
        try {
          const queued = await enqueueStockEvent(context, expected, payload, display, options);
          frozen = true;
          serial.clear();
          return queued;
        } catch (error) {
          serial.retain(current);
          serial.fail(error, serial.conflicted);
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
        serial.reset();
        return expected;
      } catch (error) {
        serial.fail(error);
        return undefined;
      }
    },
    async discard() {
      if (frozen || submitting) return false;
      await serial.wait();
      try {
        expected = await saveStockEventDraft(context, expected, []);
        current = [];
        serial.reset();
        return true;
      } catch (error) {
        serial.fail(error);
        return false;
      }
    },
    async resolve(choice: 'load' | 'copy') {
      if (frozen || submitting) return expected;
      await serial.wait();
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
      serial.reset();
      return stored;
    },
  };
}
