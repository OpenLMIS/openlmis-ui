import { isAxiosError } from 'axios';

const AT_ONCE = 5;

const isAlreadyGone = (error: unknown) =>
  isAxiosError<{ messageKey?: string }>(error) &&
  /\.assignment\.notFound$/.test(error.response?.data?.messageKey ?? '');

/** Deletes one by one, a few at a time, since the API has no bulk delete; a row someone else removed counts as deleted. */
export async function deleteAssignments(
  remove: (id: string) => Promise<void>,
  ids: readonly string[],
): Promise<{ deleted: string[]; failed: string[] }> {
  const outcomes = new Map<string, boolean>();
  const queue = [...ids];

  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        await remove(id);
        outcomes.set(id, true);
      } catch (error) {
        outcomes.set(id, isAlreadyGone(error));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, ids.length) }, worker));

  return {
    deleted: ids.filter((id) => outcomes.get(id)),
    failed: ids.filter((id) => !outcomes.get(id)),
  };
}
