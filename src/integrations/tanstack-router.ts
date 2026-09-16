import { createRouter } from '@tanstack/react-router';
import { ErrorFallback } from '@/components/error-fallback';
import { PendingFallback } from '@/components/pending-fallback';
import { queryClient } from '@/integrations/tanstack-query';
import { routeTree } from '@/route-tree.gen';

export const router = createRouter({
  routeTree,
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
