import type { AxiosRequestConfig } from 'axios';
import { client } from '@/integrations/axios';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { settleFew } from '@/lib/settle-few';
import type { Page } from '@/lib/types';

export const BY_IDS_BATCH = 100;

export async function fetchIdBatches<T, R>(ids: readonly T[], fetch: (batch: T[]) => Promise<R>) {
  const unique = [...new Set(ids)];
  const batches = Array.from({ length: Math.ceil(unique.length / BY_IDS_BATCH) }, (_, index) => ({
    index,
    ids: unique.slice(index * BY_IDS_BATCH, (index + 1) * BY_IDS_BATCH),
  }));
  const result = await settleFew(
    batches,
    async (batch) => ({ index: batch.index, value: await fetch(batch.ids) }),
    8,
  );
  if (result.failed.length) throw result.error;
  return result.done.sort((a, b) => a.index - b.index).map((item) => item.value);
}

/** The records with the given ids, at most 100 ids a request and every page of each; none is sent for no ids, which would list them all. */
export async function fetchByIds<T extends { id: string }>(
  path: string,
  ids: readonly string[],
  param = 'id',
  config?: AxiosRequestConfig,
) {
  const scope = config?.sessionScope ?? getSessionScope();
  const batches = await fetchIdBatches(ids, async (batch) => {
    const found: T[] = [];
    for (let page = 0; ; page += 1) {
      assertSessionScope(scope);
      const { data } = await client.get<Page<T>>(path, {
        ...config,
        params: { [param]: batch, page, size: BY_IDS_BATCH },
        paramsSerializer: { indexes: null },
      });
      assertSessionScope(scope);
      found.push(...data.content);
      if (page + 1 >= data.totalPages) break;
    }
    return found;
  });
  return batches.flat();
}
