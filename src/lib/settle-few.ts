const AT_ONCE = 5;

/** Runs `task` on every item, a few at a time, as the API has no bulk calls; resolves with what failed. */
export async function settleFew<T>(
  items: readonly T[],
  task: (item: T) => Promise<unknown>,
): Promise<{ failed: T[]; error?: unknown }> {
  const failed: T[] = [];
  let firstError: unknown;
  const queue = [...items];

  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      try {
        await task(item);
      } catch (error) {
        failed.push(item);
        firstError ??= error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));

  return { failed, error: firstError };
}
