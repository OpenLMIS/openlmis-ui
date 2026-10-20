import { createRouter } from '@tanstack/react-router';
import { ErrorFallback } from '@/components/error-fallback';
import { PendingFallback } from '@/components/pending-fallback';
import { isOfflineCapable } from '@/features/stock-events/lib/offline-pages';
import { queryClient } from '@/integrations/tanstack-query';
import { isOnline } from '@/lib/online';
import { getSessionScope } from '@/lib/session-scope';
import { routeTree } from '@/route-tree.gen';

// Vite derives BASE_URL from `base`; the router wants it without the trailing slash.
const basepath = import.meta.env.BASE_URL.replace(/\/$/, '');

export const router = createRouter({
  routeTree,
  basepath,
  context: {
    queryClient,
    getResolvedPathname: (): string | undefined =>
      router.state.matches.some(
        (match) =>
          match.routeId === '/(protected)/_protected' &&
          match.status === 'success' &&
          match.context.sessionScope === getSessionScope(),
      )
        ? router.state.resolvedLocation?.pathname
        : undefined,
  },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: ErrorFallback,
  defaultPendingComponent: PendingFallback,
});

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: module augmentation requires interface
  interface Register {
    router: typeof router;
  }
}

const preloadRoute = router.preloadRoute;
router.preloadRoute = (options) =>
  !isOnline() &&
  !isOfflineCapable(
    router.buildLocation(options as Parameters<typeof router.buildLocation>[0]).pathname,
  )
    ? Promise.resolve(undefined)
    : preloadRoute(options);
