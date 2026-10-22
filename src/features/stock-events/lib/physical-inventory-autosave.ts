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
  const resolve = () => {
    conflict = undefined;
    serial.reset();
  };
  return {
    enqueue: serial.enqueue,
    wait: serial.wait,
    async flush() {
      const saved = await serial.flush();
      if (conflict) throw conflict;
      if (!saved) throw new Error('Physical Inventory was not saved on this device');
    },
    async clear(remove: (conflict: unknown) => Promise<void>) {
      serial.clear();
      await serial.wait();
      await remove(conflict);
      resolve();
    },
    resolve,
    reset() {
      if (conflict instanceof DraftConflictError) return;
      serial.reset();
    },
  };
}
