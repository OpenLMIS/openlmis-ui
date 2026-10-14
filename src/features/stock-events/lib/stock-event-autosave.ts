import type { EventLine } from '@/features/stock-events/lib/event-form';
import {
  archiveStockEventCopy,
  DraftConflictError,
  readStockEventDraft,
  type StockEventContext,
  type StockEventDraft,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
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
  async function drain() {
    while (latest && !stopped) {
      const next = latest;
      latest = undefined;
      try {
        expected = await saveStockEventDraft(context, expected, next, generation?.());
        if (!latest) onStatus({ status: 'saved' });
      } catch (error) {
        stopped = true;
        conflict = error instanceof DraftConflictError;
        latest ??= next;
        onStatus({ status: error instanceof DraftConflictError ? 'conflict' : 'failed', error });
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
    async discard() {
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
        stopped = true;
        conflict = error instanceof DraftConflictError;
        onStatus({ status: conflict ? 'conflict' : 'failed', error });
        return false;
      }
    },
    async resolve(choice: 'load' | 'copy') {
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
