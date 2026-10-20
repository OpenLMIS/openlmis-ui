import { DraftConflictError } from '@/lib/draft-store';

export type DraftSaveState = {
  status: 'loading' | 'saving' | 'saved' | 'failed' | 'conflict';
  error?: unknown;
};
export function createDraftWriter<T>(
  write: (value: T) => Promise<void>,
  onStatus: (state: DraftSaveState) => void,
  retryOnChange = false,
) {
  let latest: { value: T } | undefined;
  let running: Promise<void> | undefined;
  let stopped = false;
  let conflict = false;
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
        await write(next.value);
        if (!latest) onStatus({ status: 'saved' });
      } catch (error) {
        if (retryOnChange && latest && !(error instanceof DraftConflictError)) continue;
        latest ??= next;
        fail(error);
      }
    }
  }
  function start() {
    if (stopped || !latest) return;
    running ??= drain().finally(() => {
      running = undefined;
      if (latest && !stopped) start();
    });
  }
  function stage(value: T) {
    latest = { value };
    if (retryOnChange && !conflict) stopped = false;
    if (!stopped) onStatus({ status: 'saving' });
  }
  return {
    stage,
    start,
    enqueue(value: T) {
      stage(value);
      start();
    },
    async flush() {
      start();
      await running;
      return !stopped;
    },
    wait: async () => {
      await running;
    },
    fail,
    get conflicted() {
      return conflict;
    },
    get stopped() {
      return stopped;
    },
    retain(value: T) {
      latest = { value };
    },
    clear() {
      latest = undefined;
    },
    reset() {
      latest = undefined;
      stopped = false;
      conflict = false;
      onStatus({ status: 'saved' });
    },
    retry() {
      if (conflict) return;
      stopped = false;
      onStatus({ status: 'saving' });
      start();
    },
  };
}
