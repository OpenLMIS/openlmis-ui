import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchRequisition } from '@/features/requisitions/api/api';
import { Route } from '@/routes/(protected)/_protected.requisitions.view_.$requisitionId';
import { expectRouteWarning } from '@/tests/expect-route-warning';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchDeploymentTimeZone: vi.fn(async () => 'UTC'),
  storedTimeZone: vi.fn(() => null),
  fetchUserRecord: vi.fn(async () => ({ id: 'u', roleAssignments: [] })),
  fetchRoles: vi.fn(async () => []),
  fetchUserPrograms: vi.fn(async () => [{ id: 'p', name: 'Family Planning' }]),
  fetchPrograms: vi.fn(async () => [{ id: 'p', name: 'Family Planning' }]),
  fetchMinimalFacilities: vi.fn(async () => [{ id: 'f', name: 'Comfort', code: 'HC01' }]),
}));
vi.mock('@/features/requisitions/api/api', () => ({ fetchRequisition: vi.fn() }));

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/view/$requisitionId',
    validateSearch: Route.options.validateSearch as never,
    loaderDeps: Route.options.loaderDeps as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
    errorComponent: Route.options.errorComponent as never,
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

afterEach(() => {
  cleanup();
  useLoginData.setState({ referenceDataUserId: null });
  vi.restoreAllMocks();
});

it('shows a missing requisition with a link back to the list search', async () => {
  const assertWarning = expectRouteWarning(
    '/(protected)/_protected/requisitions/view/$requisitionId/requisitions/view/missing{}',
  );
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|p']);
  vi.mocked(fetchRequisition).mockRejectedValue(httpError(404));
  const { queryClient } = renderRoute('/requisitions/view/missing?facility=f&page=3');
  await screen.findByText('requisitions.requisition.not-found-description');
  const back = screen.getByRole('button', { name: 'requisitions.requisition.back' });
  const url = new URL((back as HTMLAnchorElement).href);
  expect(url.pathname).toBe('/requisitions/view');
  expect(Object.fromEntries(url.searchParams)).toEqual({ facility: 'f', page: '3' });
  assertWarning();
  queryClient.clear();
});
