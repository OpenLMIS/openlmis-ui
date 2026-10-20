import { DraftConflictError } from '@/lib/draft-store';
import { createDraftWriter } from '@/lib/draft-writer';

export type InventorySaveStatus = 'saving' | 'saved' | 'failed' | 'conflict';

export function createInventoryWriter<T>(
  write: (value: T) => Promise<void>,
  onStatus: (status: InventorySaveStatus) => void,
) {
  let conflict: unknown;
  const serial = createDraftWriter(
    write,
    (state) => {
      if (state.status === 'conflict') conflict = state.error;
      if (state.status !== 'loading') onStatus(state.status);
    },
    true,
  );
  return {
    enqueue: serial.enqueue,
    async flush() {
      await serial.flush();
      if (conflict) throw conflict;
    },
    reset() {
      if (conflict instanceof DraftConflictError) return;
      serial.reset();
    },
  };
}
