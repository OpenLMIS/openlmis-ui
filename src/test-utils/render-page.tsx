import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  type StaticDataRouteOption,
} from '@tanstack/react-router';
import { type RenderOptions, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { OfflineNavigationProvider } from '@/components/app-shell/offline-navigation';

export function renderPage(
  page: ReactNode,
  {
    path = '/',
    queryClient = new QueryClient(),
    onCaughtError,
    routeStaticData = {},
  }: {
    path?: string;
    queryClient?: QueryClient;
    onCaughtError?: RenderOptions['onCaughtError'];
    routeStaticData?: Record<string, StaticDataRouteOption>;
  } = {},
) {
  const root = createRootRoute({
    component: () => <OfflineNavigationProvider>{page}</OfflineNavigationProvider>,
  });
  const routes = Object.entries(routeStaticData).map(([path, staticData]) =>
    createRoute({ getParentRoute: () => root, path, staticData }),
  );
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    { onCaughtError },
  );
  return router;
}
