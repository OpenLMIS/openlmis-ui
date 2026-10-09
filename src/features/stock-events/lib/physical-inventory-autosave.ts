export type InventorySaveStatus = 'saving' | 'saved' | 'failed';

export function createInventoryWriter<T>(
  write: (value: T) => Promise<void>,
  onStatus: (status: InventorySaveStatus) => void,
) {
  let latest: { value: T } | undefined;
  let running: Promise<void> | undefined;
  async function drain() {
    while (latest) {
      const next = latest;
      latest = undefined;
      try {
        await write(next.value);
        if (!latest) onStatus('saved');
      } catch {
        if (!latest) onStatus('failed');
      }
    }
    running = undefined;
  }
  return {
    enqueue(value: T) {
      latest = { value };
      onStatus('saving');
      running ??= drain();
    },
    async flush() {
      await running;
    },
  };
}
