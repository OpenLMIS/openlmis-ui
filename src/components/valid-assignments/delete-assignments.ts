import { isAxiosError } from 'axios';

const AT_ONCE = 5;

const isAlreadyGone = (error: unknown) =>
  isAxiosError<{ messageKey?: string }>(error) &&
  /\.assignment\.notFound$/.test(error.response?.data?.messageKey ?? '');

/** The API has no bulk delete; a row someone else already removed counts as deleted. */
export async function deleteAssignments(
  remove: (id: string) => Promise<void>,
  ids: readonly string[],
): Promise<{ deleted: string[]; failed: string[]; error?: unknown }> {
  const deleted: string[] = [];
  const failed: string[] = [];
  let firstError: unknown;
  const queue = [...ids];

  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        await remove(id);
        deleted.push(id);
      } catch (error) {
        if (isAlreadyGone(error)) {
          deleted.push(id);
        } else {
          failed.push(id);
          firstError ??= error;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, ids.length) }, worker));

  return { deleted, failed, error: firstError };
}
