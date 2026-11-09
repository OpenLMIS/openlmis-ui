import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchMinimalFacilities } from '@/features/reference-data/api/api';
import { Route } from '@/routes/(protected)/_protected.requisitions.create-orders';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchUserPrograms: vi.fn(async () => []),
  fetchMinimalFacilities: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/create-orders',
    validateSearch: Route.options.validateSearch as never,
    loaderDeps: Route.options.loaderDeps as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
    pendingComponent: Route.options.pendingComponent as never,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([list] as never)] as never),
    ] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    { onCaughtError: () => {} },
  );
  return { router, queryClient };
}

it('shows a retryable error when facilities fail and restores the deferred form on retry', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'u', username: 'u', accessToken: 'token' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['ORDER_CREATE|f|p']);
  vi.mocked(fetchMinimalFacilities).mockRejectedValue(new Error('Facilities unavailable'));
  const { queryClient } = renderRoute('/requisitions/create-orders');
  const retry = await screen.findByRole('button', { name: 'Try Again' });
  vi.mocked(fetchMinimalFacilities).mockResolvedValue([
    { id: 'f', code: 'F', name: 'Facility', active: true },
  ]);
  fireEvent.click(retry);
  await screen.findByRole('button', { name: 'orders.create.create' });
  expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument();
  queryClient.clear();
});
