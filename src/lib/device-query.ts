import { type QueryKey, queryOptions } from '@tanstack/react-query';
import { deviceQueryKey } from '@/lib/key-factory';
import { onlineOrDevice } from '@/lib/local-data';
import { offlineAccessQuery } from '@/lib/offline-access';

export function deviceQuery<T>({
  queryKey,
  online,
  server,
  device,
  staleTime,
}: {
  queryKey: QueryKey;
  online: boolean;
  server: () => Promise<T>;
  device?: () => Promise<T>;
  staleTime: number;
}) {
  return queryOptions({
    queryKey: device && !online ? deviceQueryKey(queryKey) : queryKey,
    queryFn: () => (device ? onlineOrDevice(server, device) : server()),
    ...offlineAccessQuery(staleTime),
  });
}
