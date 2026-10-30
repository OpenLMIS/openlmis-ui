import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchApprovalList } from '@/features/requisitions/api/api';
import { useFlag } from '@/lib/feature-flags';
import { Route } from '@/routes/(protected)/_protected.requisitions.approve';

vi.mock('@/lib/feature-flags', () => ({ useFlag: vi.fn(() => false) }));
vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchCurrencySettings: vi.fn(async () => ({ timeZoneId: 'UTC' })),
  storedTimeZone: vi.fn(() => null),
  fetchUserRecord: vi.fn(async () => ({
    id: 'u',
    roleAssignments: [{ roleId: 'role', programId: '11111111-1111-4111-8111-111111111111' }],
  })),
  fetchRoles: vi.fn(async () => [{ id: 'role', rights: [{ name: 'REQUISITION_APPROVE' }] }]),
  fetchUserPrograms: vi.fn(async () => [{ id: 'p', name: 'Family Planning' }]),
  fetchPrograms: vi.fn(async () => [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Family Planning' },
  ]),
  fetchMinimalFacilities: vi.fn(async () => [{ id: 'f', name: 'Comfort', code: 'HC01' }]),
}));
vi.mock('@/features/requisitions/api/api', () => ({ fetchApprovalList: vi.fn() }));

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'requisitions/approve',
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
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_APPROVE|f|p']);
  vi.mocked(fetchApprovalList).mockResolvedValue({
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
  vi.unstubAllEnvs();
  vi.mocked(useFlag).mockReturnValue(false);
});

it.each([
  ['', { page: 0, size: 20, sort: ['emergency,desc', 'authorizedDate,desc'] }],
  [
    '?page=3&dir=asc&program=11111111-1111-4111-8111-111111111111',
    {
      page: 2,
      size: 20,
      program: '11111111-1111-4111-8111-111111111111',
      sort: ['emergency,desc', 'authorizedDate,asc'],
    },
  ],
])('maps approval URL %s to the legacy request', async (search, expected) => {
  const { queryClient } = renderRoute(`/requisitions/approve${search}`);
  await waitFor(() => expect(fetchApprovalList).toHaveBeenCalledWith(expected));
  await screen.findByText(
    search ? 'requisitions.view.no-matches-title' : 'requisitions.approve.empty',
  );
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByText('requisitions.approve.note')).not.toBeInTheDocument();
  queryClient.clear();
});
it('refuses approval access before fetching rows or lookups', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['REQUISITION_VIEW|f|p']);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const loader = Route.options.loader as (context: unknown) => Promise<unknown>;
  await expect(loader({ context: { queryClient }, deps: { search: {} } })).rejects.toBeInstanceOf(
    ForbiddenError,
  );
  expect(fetchApprovalList).not.toHaveBeenCalled();
  queryClient.clear();
});
it.each([1200, 390])(
  'selects and clears the page at width %s with the batch flag on',
  async (width) => {
    vi.mocked(useFlag).mockReturnValue(true);
    vi.stubEnv('BASE_URL', '/v2/');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
    vi.mocked(fetchApprovalList).mockResolvedValue({
      content: [
        {
          id: 'r',
          program: { id: 'p', name: 'Family Planning' },
          facility: { code: 'HC01', name: 'Comfort' },
          processingPeriod: { name: 'March' },
          status: 'AUTHORIZED',
          emergency: false,
        },
      ],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    const { queryClient } = renderRoute('/requisitions/approve');
    const checkboxes = await screen.findAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);
    await screen.findByRole('button', { name: 'Clear Selection' });
    expect(screen.getAllByRole('checkbox').at(-1)).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(screen.getAllByRole('checkbox').at(-1)).not.toBeChecked();
    queryClient.clear();
  },
);
