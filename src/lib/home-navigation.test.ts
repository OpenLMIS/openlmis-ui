import { QueryClient } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, it } from 'vitest';
import { systemNotificationsOptions } from '@/features/system-notifications/api/queries';
import { cancelHomeOnNavigation } from '@/lib/home-navigation';
import { queryKeys } from '@/lib/key-factory';

it('cancels Home requests before the destination loader settles and keeps unrelated requests', async () => {
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
  let notificationSignal!: AbortSignal;
  const notifications = client.prefetchQuery({
    queryKey: systemNotificationsOptions().queryKey,
    queryFn: (context) => {
      notificationSignal = context.signal;
      return pending.promise.then(() => []);
    },
  });
  let homeReportSignal!: AbortSignal;
  void client.prefetchQuery({
    queryKey: queryKeys.dashboardReports.list({ userId: 'ada', showOnHomePage: true }),
    queryFn: (context) => {
      homeReportSignal = context.signal;
      return pending.promise.then(() => null);
    },
  });
  let catalogSignal!: AbortSignal;
  const catalog = client.prefetchQuery({
    queryKey: queryKeys.dashboardReports.list({ userId: 'ada', showOnHomePage: false }),
    queryFn: (context) => {
      catalogSignal = context.signal;
      return pending.promise.then(() => []);
    },
  });
  const navigating = router.navigate({ to: '/page' as never });
  expect(signal.aborted).toBe(true);
  expect(notificationSignal.aborted).toBe(false);
  expect(homeReportSignal.aborted).toBe(true);
  expect(catalogSignal.aborted).toBe(false);
  pending.resolve();
  await Promise.all([navigating, notifications, catalog]);
  stop();
  client.clear();
});
