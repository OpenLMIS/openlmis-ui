const AT_ONCE = 5;

/** Runs `task` on every item, five at a time, as the API has no bulk calls; never rejects. */
export async function settleFew<T, R>(
  items: readonly T[],
  task: (item: T) => Promise<R>,
): Promise<{ done: R[]; failed: T[]; error?: unknown }> {
  const done: R[] = [];
  const failed: T[] = [];
  let firstError: unknown;
  const queue = [...items];

  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      try {
        done.push(await task(item));
      } catch (error) {
        failed.push(item);
        firstError ??= error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));

  return { done, failed, error: firstError };
}
