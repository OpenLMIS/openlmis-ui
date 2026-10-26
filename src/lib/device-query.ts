import { type QueryFunctionContext, type QueryKey, queryOptions } from '@tanstack/react-query';
import { deviceQueryKey } from '@/lib/key-factory';
import { onlineOrDevice } from '@/lib/local-data';
import { offlineAccessQuery } from '@/lib/offline-access';

export function deviceQuery<T>({
  queryKey,
  online,
  server,
  device,
  staleTime,
  canFallback,
}: {
  queryKey: QueryKey;
  online: boolean;
  server: (context: QueryFunctionContext) => Promise<T>;
  device?: () => Promise<T>;
  staleTime: number;
  canFallback?: (error: unknown) => boolean;
}) {
  return queryOptions({
    queryKey: device && !online ? deviceQueryKey(queryKey) : queryKey,
    queryFn: (context) =>
      device ? onlineOrDevice(() => server(context), device, canFallback) : server(context),
    ...offlineAccessQuery(staleTime),
  });
}
