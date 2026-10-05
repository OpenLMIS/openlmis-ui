import { isAxiosError } from 'axios';

const AT_ONCE = 5;

const isAlreadyGone = (error: unknown) =>
  isAxiosError<{ messageKey?: string }>(error) &&
  /\.assignment\.notFound$/.test(error.response?.data?.messageKey ?? '');

/** The API has no bulk delete; a row someone else already removed counts as deleted. */
export async function deleteAssignments(
  remove: (id: string) => Promise<void>,
  ids: readonly string[],
): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];
  const queue = [...ids];

  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        await remove(id);
        deleted.push(id);
      } catch (error) {
        (isAlreadyGone(error) ? deleted : failed).push(id);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, ids.length) }, worker));

  return { deleted, failed };
}
