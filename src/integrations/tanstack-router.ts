import { createRouter } from '@tanstack/react-router';
import { ErrorFallback } from '@/components/error-fallback';
import { PendingFallback } from '@/components/pending-fallback';
import { queryClient } from '@/integrations/tanstack-query';
import { routeTree } from '@/route-tree.gen';

// Vite derives BASE_URL from `base`; the router wants it without the trailing slash.
const basepath = import.meta.env.BASE_URL.replace(/\/$/, '');

export const router = createRouter({
  routeTree,
  basepath,
  context: { queryClient },
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
