import { SessionEndedError } from '@/features/auth/lib/session';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

const AT_ONCE = 5;

export async function settleFew<T, R>(
  items: readonly T[],
  task: (item: T) => Promise<R>,
): Promise<{ done: R[]; failed: T[]; error?: unknown }> {
  const scope = getSessionScope();
  const done: R[] = [];
  const failed: T[] = [];
  let firstError: unknown;
  const queue = [...items];

  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      try {
        assertSessionScope(scope);
        const result = await task(item);
        assertSessionScope(scope);
        done.push(result);
      } catch (error) {
        if (error instanceof SessionEndedError || scope !== getSessionScope()) {
          queue.length = 0;
          assertSessionScope(scope);
          throw error;
        }
        failed.push(item);
        firstError ??= error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));

  assertSessionScope(scope);
  return { done, failed, error: firstError };
}
