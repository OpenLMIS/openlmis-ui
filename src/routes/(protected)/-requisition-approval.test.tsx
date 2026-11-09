import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OfflineNavigationProvider } from '@/components/app-shell/offline-navigation';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchPrograms } from '@/features/reference-data/api/api';
import { fetchApprovalList } from '@/features/requisitions/api/api';
import { readCopies } from '@/features/requisitions/lib/offline-copies';
import * as offlineSearch from '@/features/requisitions/lib/offline-search';
import { useFlag } from '@/lib/feature-flags';
import { LocalDataUnavailableError } from '@/lib/local-data';
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
vi.mock('@/features/requisitions/lib/offline-access', async (original) => ({
  ...(await original<typeof import('@/features/requisitions/lib/offline-access')>()),
  prepareRequisitionAccess: vi.fn(async () => {}),
}));
vi.mock('@/features/requisitions/api/api', () => ({ fetchApprovalList: vi.fn() }));

vi.mock('@/features/requisitions/lib/offline-copies', async (original) => ({
  ...(await original<typeof import('@/features/requisitions/lib/offline-copies')>()),
  readCopies: vi.fn(async () => []),
}));

function renderRoute(
  path: string,
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, networkMode: 'always' } },
  }),
) {
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
      <OfflineNavigationProvider>
        <RouterProvider router={router} />
      </OfflineNavigationProvider>
    </QueryClientProvider>,
    { onCaughtError: () => {} },
  );
  return { router, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readCopies).mockResolvedValue([]);
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
  ['', { page: 0, size: 10, sort: ['emergency,desc', 'authorizedDate,desc'] }],
  [
    '?page=3&dir=asc&program=11111111-1111-4111-8111-111111111111',
    {
      page: 2,
      size: 10,
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
  'keeps ticks across pages and refuses mixed programs at width %s',
  async (width) => {
    vi.mocked(useFlag).mockReturnValue(true);
    vi.stubEnv('BASE_URL', '/v2/');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
    const row = (id: string, programId: string, name: string) => ({
      id,
      program: { id: programId, name },
      facility: { code: 'HC01', name: 'Comfort' },
      processingPeriod: { name: id },
      status: 'AUTHORIZED' as const,
      emergency: false,
    });
    vi.mocked(fetchApprovalList).mockImplementation(async ({ page }) => ({
      content: [page ? row('April', 'b', 'ARV') : row('March', 'a', 'Family Planning')],
      number: page,
      size: 1,
      totalElements: 2,
      totalPages: 2,
    }));
    const { router, queryClient } = renderRoute('/requisitions/approve?size=1');
    await screen.findAllByText('March');
    await userEvent.click(screen.getAllByRole('checkbox').at(-1) as HTMLElement);
    await router.navigate({ to: '.', search: { size: 1, page: 2 } });
    await screen.findAllByText('April');
    await userEvent.click(screen.getAllByRole('checkbox').at(-1) as HTMLElement);
    await userEvent.click(
      screen.getAllByRole('button', { name: /requisitions\.approve\.view-selected/ })[0],
    );
    await screen.findByText('requisitions.approve.select-mixed-title');
    queryClient.clear();
  },
);

it('explains an empty device list without clearing its required program', async () => {
  const program = '11111111-1111-4111-8111-111111111111';
  vi.spyOn(offlineSearch, 'localApprovals').mockResolvedValue({
    content: [],
    number: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
  });
  const { router, queryClient } = renderRoute(
    `/requisitions/approve?program=${program}&offline=true`,
  );
  await screen.findByText('requisitions.offline.empty-title');
  expect(
    screen.queryByRole('button', { name: 'data-table.clear-filters' }),
  ).not.toBeInTheDocument();
  expect(router.state.location.search.program).toBe(program);
  expect(fetchApprovalList).not.toHaveBeenCalled();
  queryClient.clear();
});

it('hides View Selected Requisitions when the approval list is empty', async () => {
  vi.mocked(useFlag).mockReturnValue(true);
  const { queryClient } = renderRoute('/requisitions/approve');
  await screen.findByText('requisitions.approve.empty');
  expect(
    screen.queryByRole('button', { name: 'requisitions.approve.view-selected' }),
  ).not.toBeInTheDocument();
  queryClient.clear();
});

it('ticks and clears the page with the header checkbox and sorts oldest first', async () => {
  vi.mocked(useFlag).mockReturnValue(true);
  const row = (id: string) => ({
    id,
    program: { id: 'a', name: 'Family Planning' },
    facility: { code: 'HC01', name: 'Comfort' },
    processingPeriod: { name: id },
    status: 'AUTHORIZED' as const,
    emergency: false,
  });
  vi.mocked(fetchApprovalList).mockResolvedValue({
    content: [row('March'), row('April')],
    number: 0,
    size: 10,
    totalElements: 2,
    totalPages: 1,
  });
  const { router, queryClient } = renderRoute('/requisitions/approve');
  await screen.findAllByText('March');
  expect(
    screen.queryByRole('group', { name: 'requisitions.approve.select' }),
  ).not.toBeInTheDocument();
  const select = screen.getAllByRole('checkbox')[0];
  await userEvent.click(select);
  expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(3);
  expect(
    screen.getByRole('button', { name: /requisitions\.approve\.view-selected/ }),
  ).toBeInTheDocument();
  await userEvent.click(select);
  expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(0);
  expect(
    screen.queryByRole('button', { name: /requisitions\.approve\.view-selected/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('combobox', { name: 'data-table.sort-by' }));
  await userEvent.click(
    await screen.findByRole('option', { name: 'requisitions.approve.sort-oldest' }),
  );
  await waitFor(() =>
    expect(fetchApprovalList).toHaveBeenLastCalledWith({
      page: 0,
      size: 10,
      sort: ['emergency,desc', 'authorizedDate,asc'],
    }),
  );
  expect(router.state.location.search).toMatchObject({ sort: 'authorizedDate', dir: 'asc' });
  queryClient.clear();
});

it('keeps fetched approval rows on disconnect until an offline filter change', async () => {
  const rows = ['Online Only', 'Saved Copy'].map((name, index) => ({
    id: `r${index}`,
    emergency: false,
    status: 'AUTHORIZED' as const,
    program: { id: '11111111-1111-4111-8111-111111111111', name: 'Family Planning' },
    facility: { id: 'f', name: 'Comfort' },
    processingPeriod: { id: name, name },
  }));
  vi.mocked(readCopies).mockResolvedValue([
    { id: 'r1', fetchedAt: 1700000000000, single: { record: rows[1] } } as never,
  ]);
  vi.mocked(fetchApprovalList).mockResolvedValue({
    content: rows,
    number: 0,
    size: 10,
    totalElements: 2,
    totalPages: 1,
  });
  const local = vi.spyOn(offlineSearch, 'localApprovals').mockResolvedValue({
    content: [rows[1]],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  const { queryClient } = renderRoute('/requisitions/approve');
  await screen.findByText('Online Only');
  await act(() => onlineManager.setOnline(false));
  expect(screen.getByText('Online Only')).toBeVisible();
  expect(local).not.toHaveBeenCalled();
  expect(await screen.findByText('requisitions.offline.online-results')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  await userEvent.click(screen.getByRole('combobox', { name: 'requisitions.filters.program' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Family Planning' }));
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(local).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText('Online Only')).not.toBeInTheDocument());
  expect(screen.getByText('Saved Copy')).toBeVisible();
  expect(local).toHaveBeenCalled();
  queryClient.clear();
});

it('reopens the last online list offline and explains rows without a saved copy', async () => {
  await act(() => onlineManager.setOnline(true));
  const rows = ['Online Only', 'Saved Copy'].map((name, index) => ({
    id: `r${index}`,
    emergency: false,
    status: 'AUTHORIZED' as const,
    program: { id: '11111111-1111-4111-8111-111111111111', name: 'Family Planning' },
    facility: { id: 'f', name: 'Comfort' },
    processingPeriod: { id: name, name },
  }));
  vi.mocked(readCopies).mockResolvedValue([
    { id: 'r1', fetchedAt: 1700000000000, single: { record: rows[1] } } as never,
  ]);
  vi.mocked(fetchApprovalList).mockResolvedValue({
    content: rows,
    number: 0,
    size: 10,
    totalElements: 2,
    totalPages: 1,
  });
  const local = vi.spyOn(offlineSearch, 'localApprovals');
  const { queryClient } = renderRoute('/requisitions/approve');
  await screen.findByText('Online Only');
  cleanup();
  await act(() => onlineManager.setOnline(false));
  const { router } = renderRoute('/requisitions/approve', queryClient);
  expect(await screen.findByText('Online Only')).toBeVisible();
  expect(await screen.findByText('requisitions.offline.online-results')).toBeVisible();
  expect(local).not.toHaveBeenCalled();
  const [unsaved, saved] = screen.getAllByRole('button', {
    name: 'requisitions.view.action-name',
  });
  expect(saved).toHaveAttribute('href', '/requisitions/view/r1');
  await userEvent.click(unsaved);
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('offline.navigation-title');
  expect(router.state.location.pathname).toBe('/requisitions/approve');
  cleanup();
  queryClient.removeQueries({ queryKey: ['requisitions', 'approval'] });
  renderRoute('/requisitions/approve', queryClient);
  expect(await screen.findByText('requisitions.approve.offline-empty-title')).toBeVisible();
  expect(fetchApprovalList).toHaveBeenCalledTimes(1);
  queryClient.clear();
});

it('falls back to local approvals after retained pages are evicted offline', async () => {
  const program = '11111111-1111-4111-8111-111111111111';
  const rows = [
    {
      id: 'saved',
      emergency: false,
      status: 'AUTHORIZED' as const,
      program: { id: program, name: 'Family Planning' },
      facility: { id: 'f', name: 'Comfort' },
      processingPeriod: { id: 'period', name: 'Saved Period' },
    },
  ];
  vi.mocked(fetchApprovalList).mockResolvedValue({
    content: rows,
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  const local = vi
    .spyOn(offlineSearch, 'localApprovals')
    .mockResolvedValue({ content: rows, number: 0, size: 10, totalElements: 1, totalPages: 1 });
  const { queryClient } = renderRoute(`/requisitions/approve?program=${program}`);
  await screen.findByText('Saved Period');
  await act(() => onlineManager.setOnline(false));
  await act(() => queryClient.resetQueries({ queryKey: ['requisitions', 'approval'] }));
  await waitFor(() => expect(local).toHaveBeenCalled());
  expect(screen.getByText('Saved Period')).toBeVisible();
  queryClient.clear();
});

it('shows a compact filter note when the saved list is usable', async () => {
  const program = '11111111-1111-4111-8111-111111111111';
  vi.mocked(fetchPrograms).mockRejectedValue(new LocalDataUnavailableError());
  vi.mocked(readCopies).mockResolvedValue([{ id: 'saved', fetchedAt: 1 } as never]);
  vi.spyOn(offlineSearch, 'localApprovals').mockResolvedValue({
    content: [
      {
        id: 'saved',
        emergency: false,
        status: 'AUTHORIZED',
        program: { id: program },
        facility: { id: 'f' },
        processingPeriod: { id: 'period', name: 'Usable Copy' },
      },
    ],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  const { queryClient } = renderRoute(`/requisitions/approve?program=${program}&offline=true`);
  expect(await screen.findByText('Usable Copy')).toBeVisible();
  expect(await screen.findByText('requisitions.offline.filter-choices-missing')).toBeVisible();
  expect(screen.queryByText('offline.not-downloaded-title')).not.toBeInTheDocument();
  queryClient.clear();
  vi.mocked(fetchPrograms).mockResolvedValue([{ id: program, name: 'Family Planning' }] as never);
});
