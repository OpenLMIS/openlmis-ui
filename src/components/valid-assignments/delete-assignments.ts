import { isAxiosError } from 'axios';
import { settleFew } from '@/lib/settle-few';

const isAlreadyGone = (error: unknown) =>
  isAxiosError<{ messageKey?: string }>(error) &&
  /\.assignment\.notFound$/.test(error.response?.data?.messageKey ?? '');

/** The API has no bulk delete; a row someone else already removed counts as deleted. */
export async function deleteAssignments(
  remove: (id: string) => Promise<void>,
  ids: readonly string[],
): Promise<{ deleted: string[]; failed: string[]; error?: unknown }> {
  const { done, failed, error } = await settleFew(ids, (id) =>
    remove(id).then(
      () => id,
      (reason: unknown) => {
        if (!isAlreadyGone(reason)) throw reason;
        return id;
      },
    ),
  );
  return { deleted: done, failed, error };
}
