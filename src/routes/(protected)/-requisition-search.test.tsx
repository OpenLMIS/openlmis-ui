import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { searchRequisitions } from '@/features/requisitions/api/api';
import { Route } from '@/routes/(protected)/_protected.requisitions.view';
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
vi.mock('@/features/requisitions/api/api', () => ({ searchRequisitions: vi.fn() }));

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/view',
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1200,
  } as DOMRect);
  useLoginData.setState({ referenceDataUserId: 'u' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|p']);
  vi.mocked(searchRequisitions).mockResolvedValue({
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('does not search until the selected facility is applied', async () => {
  const { queryClient } = renderRoute('/requisitions/view');
  await screen.findByRole('button', { name: 'facility-program.search' });
  expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
  expect(searchRequisitions).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'facility-program.search' }));
  await waitFor(() =>
    expect(searchRequisitions).toHaveBeenCalledWith(
      expect.objectContaining({
        facility: 'f',
        page: 0,
        size: 10,
        sort: ['createdDate,desc', 'id'],
      }),
    ),
  );
  queryClient.clear();
});

it('restores filters from the URL and returns to page one when a status changes', async () => {
  const { router, queryClient } = renderRoute(
    '/requisitions/view?facility=f&program=p&status=AUTHORIZED&initiatedFrom=2026-01-01&initiatedTo=2026-02-01&page=3&dir=asc',
  );
  await waitFor(() =>
    expect(searchRequisitions).toHaveBeenCalledWith({
      facility: 'f',
      program: 'p',
      requisitionStatus: 'AUTHORIZED',
      initiatedDateFrom: '2026-01-01',
      initiatedDateTo: '2026-02-01',
      page: 2,
      size: 10,
      sort: ['createdDate,asc', 'id'],
    }),
  );
  await userEvent.click(await screen.findByRole('button', { name: /^Filters/ }));
  await userEvent.click(screen.getByRole('combobox', { name: 'requisitions.filters.status' }));
  await userEvent.click(
    await screen.findByRole('option', { name: 'requisitions.status.approved' }),
  );
  await waitFor(() => expect(router.state.location.search.page).toBeUndefined());
  expect(router.state.location.search.status).toBe('APPROVED');
  await act(() => router.navigate({ search: { facility: 'forbidden' } as never }));
  await screen.findByText('requisitions.view.refused-title');
  expect(searchRequisitions).not.toHaveBeenCalledWith(
    expect.objectContaining({ facility: 'forbidden' }),
  );
  queryClient.clear();
});

it('recovers a failed results query when URL filters change', async () => {
  vi.mocked(searchRequisitions).mockRejectedValue(httpError(500));
  const { router, queryClient } = renderRoute('/requisitions/view?facility=f');
  await screen.findByText('requisitions.view.error-title');
  vi.mocked(searchRequisitions).mockResolvedValue({
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });
  await act(() => router.navigate({ search: { facility: 'f', status: 'APPROVED' } as never }));
  await screen.findByText('requisitions.view.no-matches-title');
  expect(searchRequisitions).toHaveBeenCalledWith(
    expect.objectContaining({ requisitionStatus: 'APPROVED' }),
  );
  queryClient.clear();
});

it.each([1200, 390])('keeps row details and navigation in the %ipx layout', async (width) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
  vi.mocked(searchRequisitions).mockResolvedValue({
    content: [
      {
        id: 'r1',
        emergency: false,
        status: 'AUTHORIZED',
        createdDate: '2026-01-02T12:00:00Z',
        program: { name: 'Family Planning' },
        facility: { code: 'HC01', name: 'Comfort' },
        processingPeriod: { name: 'January', startDate: '2026-01-01', endDate: '2026-01-31' },
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  const { router, queryClient } = renderRoute('/requisitions/view?facility=f&page=3');
  await screen.findByText('January');
  expect(screen.getByText('Jan 1, 2026')).toBeVisible();
  expect(screen.getByText('requisitions.status.authorized')).toBeVisible();
  expect(screen.getByText('requisitions.no')).toBeVisible();
  const link = screen.getByRole('button', { name: 'requisitions.view.action-name' });
  const destination = new URL(link.getAttribute('href') ?? '', 'http://localhost');
  expect(destination.pathname).toBe('/requisitions/view/r1');
  expect(destination.searchParams.get('facility')).toBe('f');
  expect(destination.searchParams.get('page')).toBe('3');
  if (width === 1200) {
    const table = screen.getByRole('table');
    await userEvent.click(
      within(table).getByRole('button', { name: 'requisitions.columns.date-initiated' }),
    );
    await waitFor(() => expect(router.state.location.search.dir).toBe('asc'));
    expect(router.state.location.search.page).toBeUndefined();
  } else {
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'card-actions.actions-for' })).toContainElement(link);
  }
  queryClient.clear();
});
