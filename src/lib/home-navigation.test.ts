import { QueryClient } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, it } from 'vitest';
import { cancelHomeOnNavigation } from '@/lib/home-navigation';
import { queryKeys } from '@/lib/key-factory';

it('cancels Home requests before the destination loader settles', async () => {
  const root = createRootRoute();
  const pending = Promise.withResolvers<void>();
  const home = createRoute({ getParentRoute: () => root, path: '/home' });
  const page = createRoute({
    getParentRoute: () => root,
    path: '/page',
    loader: () => pending.promise,
  });
  const router = createRouter({
    routeTree: root.addChildren([home, page]),
    history: createMemoryHistory({ initialEntries: ['/home'] }),
  });
  const client = new QueryClient();
  const stop = cancelHomeOnNavigation(router, client);
  await router.load();
  let signal!: AbortSignal;
  void client.prefetchQuery({
    queryKey: [...queryKeys.home.all, 'test'],
    queryFn: (context) => {
      signal = context.signal;
      return pending.promise;
    },
  });
  const navigating = router.navigate({ to: '/page' as never });
  expect(signal.aborted).toBe(true);
  pending.resolve();
  await navigating;
  stop();
  client.clear();
});
