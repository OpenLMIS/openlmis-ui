import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import { homeReportQueryKey, queryKeys } from '@/lib/key-factory';

export function cancelHomeQueries(client: QueryClient) {
  void client.cancelQueries({ queryKey: queryKeys.home.all });
  void client.cancelQueries({ queryKey: homeReportQueryKey() });
}

export function cancelHomeOnNavigation(router: AnyRouter, client: QueryClient) {
  return router.subscribe('onBeforeNavigate', ({ fromLocation, toLocation }) => {
    if (fromLocation?.pathname.endsWith('/home') && fromLocation.pathname !== toLocation.pathname)
      cancelHomeQueries(client);
  });
}
