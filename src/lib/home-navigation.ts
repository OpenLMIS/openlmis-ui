import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import { queryKeys } from '@/lib/key-factory';

export function cancelHomeOnNavigation(router: AnyRouter, client: QueryClient) {
  return router.subscribe('onBeforeNavigate', ({ fromLocation, toLocation }) => {
    if (fromLocation?.pathname.endsWith('/home') && fromLocation.pathname !== toLocation.pathname)
      void client.cancelQueries({ queryKey: queryKeys.home.all });
  });
}
