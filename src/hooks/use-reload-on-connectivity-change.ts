import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useOnConnectivityChange } from '@/lib/online';

export function useReloadOnConnectivityChange(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const router = useRouter();
  useOnConnectivityChange((online) => {
    if (online) void queryClient.invalidateQueries({ queryKey });
    void router.invalidate();
  });
}
