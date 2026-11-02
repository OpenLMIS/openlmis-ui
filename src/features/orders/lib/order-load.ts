import type { QueryClient } from '@tanstack/react-query';
import { orderOptions } from '@/features/orders/api/queries';
import type { Order } from '@/features/orders/lib/types';
import { isNotFound, isRefused } from '@/lib/http';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export type OrderProblem = 'not-found' | 'no-read-access' | 'not-creating' | 'unresolved';
export type LoadedOrder = { id: string; order?: Order; problem?: OrderProblem };
export async function loadOrders(
  client: QueryClient,
  ids: readonly string[],
  fresh: boolean,
): Promise<LoadedOrder[]> {
  const scope = getSessionScope();
  const results = await Promise.allSettled(
    ids.map((id) =>
      client.fetchQuery({
        ...orderOptions(id),
        staleTime: fresh ? 0 : Number.POSITIVE_INFINITY,
        retry: false,
      }),
    ),
  );
  assertSessionScope(scope);
  return results.map((result, index) => {
    const id = ids[index];
    if (result.status === 'fulfilled')
      return {
        id,
        order: result.value,
        ...(result.value.status !== 'CREATING' && { problem: 'not-creating' as const }),
      };
    if (isRefused(result.reason)) return { id, problem: 'no-read-access' };
    if (isNotFound(result.reason)) return { id, problem: 'not-found' };
    throw result.reason;
  });
}

export function cachedOrders(
  client: QueryClient,
  ids: readonly string[],
): LoadedOrder[] | undefined {
  const entries: LoadedOrder[] = [];
  for (const id of ids) {
    const state = client.getQueryState<Order>(orderOptions(id).queryKey);
    if (state?.data) {
      const order = state.data;
      entries.push({
        id,
        order,
        ...(order.status !== 'CREATING' && { problem: 'not-creating' as const }),
      });
    } else if (isRefused(state?.error)) entries.push({ id, problem: 'no-read-access' });
    else if (isNotFound(state?.error)) entries.push({ id, problem: 'not-found' });
    else return undefined;
  }
  return entries;
}
