import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
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
  }: {
    path?: string;
    queryClient?: QueryClient;
    onCaughtError?: RenderOptions['onCaughtError'];
  } = {},
) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <OfflineNavigationProvider>{page}</OfflineNavigationProvider>,
    }),
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
