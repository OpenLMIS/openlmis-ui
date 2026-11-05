import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import {
  fetchMinimalFacilities,
  fetchPrograms,
  fetchRequisitionGroup,
  fetchRoles,
  fetchSupervisoryNodesByIds,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import { searchRequisitions } from '@/features/requisitions/api/api';
import { readCopies, removalDecision } from '@/features/requisitions/lib/offline-copies';
import { localRequisitions } from '@/features/requisitions/lib/offline-search';
import { Route } from '@/routes/(protected)/_protected.requisitions.view';
import { httpError } from '@/test-utils/http-error';

const security = vi.hoisted(() => ({ secure: true }));
vi.mock('@/lib/secure-context', () => ({
  get isSecureOrigin() {
    return security.secure;
  },
}));
vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchSupervisoryNodesByIds: vi.fn(async () => []),
  fetchRequisitionGroup: vi.fn(),
  fetchCurrencySettings: vi.fn(async () => ({ timeZoneId: 'UTC' })),
  storedTimeZone: vi.fn(() => null),
  fetchUserRecord: vi.fn(async () => ({ id: 'u', roleAssignments: [] })),
  fetchRoles: vi.fn(async () => []),
  fetchUserPrograms: vi.fn(async () => [{ id: 'p', name: 'Family Planning' }]),
  fetchPrograms: vi.fn(async () => [{ id: 'p', name: 'Family Planning' }]),
  fetchMinimalFacilities: vi.fn(async () => [{ id: 'f', name: 'Comfort', code: 'HC01' }]),
}));
vi.mock('@/features/requisitions/lib/offline-access', async (original) => ({
  ...(await original<typeof import('@/features/requisitions/lib/offline-access')>()),
  prepareRequisitionAccess: vi.fn(async () => {}),
}));
vi.mock('@/features/requisitions/api/api', () => ({ searchRequisitions: vi.fn() }));

vi.mock('@/features/requisitions/lib/offline-copies', async (original) => ({
  ...(await original<typeof import('@/features/requisitions/lib/offline-copies')>()),
  readCopies: vi.fn(async () => []),
  removalDecision: vi.fn(),
}));
vi.mock('@/features/requisitions/lib/offline-search', () => ({ localRequisitions: vi.fn() }));

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, networkMode: 'always' } },
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
  vi.mocked(readCopies).mockResolvedValue([]);
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
  expect(screen.getByText('requisitions.view.search-pending-title')).toBeInTheDocument();
  expect(screen.queryByText('requisitions.view.pick-title')).not.toBeInTheDocument();
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
  const link = screen.getByRole('button', { name: 'requisitions.view.action-name' });
  const destination = new URL(link.getAttribute('href') ?? '', 'http://localhost');
  expect(destination.pathname).toBe('/requisitions/view/r1');
  expect(Object.fromEntries(destination.searchParams)).toEqual({ facility: 'f', page: '3' });
  if (width === 1200) {
    const table = screen.getByRole('table');
    const index = within(table)
      .getAllByRole('columnheader')
      .findIndex((cell) => cell.textContent === 'requisitions.columns.emergency');
    const row = screen.getByText('January').closest('tr');
    expect(row && within(row).getAllByRole('cell')[index]).toHaveTextContent('requisitions.no');
    await userEvent.click(
      within(table).getByRole('button', { name: 'requisitions.columns.date-initiated' }),
    );
    await waitFor(() => expect(router.state.location.search.dir).toBe('asc'));
    expect(router.state.location.search.page).toBeUndefined();
  } else {
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(link.closest('li')).toHaveTextContent(
      /requisitions.columns.emergency\s*requisitions.no/,
    );
    expect(screen.getByRole('group', { name: 'card-actions.actions-for' })).toContainElement(link);
  }
  queryClient.clear();
});

it('only warns about missing programs after a facility has been selected', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    'REQUISITION_VIEW|f|p',
    'REQUISITION_VIEW|other|p',
  ]);
  vi.mocked(fetchMinimalFacilities).mockResolvedValueOnce([
    { id: 'f', name: 'Comfort', code: 'HC01', active: true },
    { id: 'other', name: 'Other', code: 'HC02', active: true },
  ]);
  vi.mocked(fetchUserPrograms).mockResolvedValueOnce([]);
  vi.mocked(fetchPrograms).mockResolvedValueOnce([]);
  const { router, queryClient } = renderRoute('/requisitions/view');
  await screen.findByRole('button', { name: 'facility-program.search' });
  await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  expect(screen.getByRole('combobox', { name: 'requisitions.filters.program' })).toBeDisabled();
  expect(screen.queryByText('requisitions.view.no-programs')).not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await act(() => router.navigate({ search: { facility: 'f' } as never }));
  await screen.findByText('requisitions.view.empty-title');
  await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  expect(screen.getByText('requisitions.view.no-programs')).toBeVisible();
  queryClient.clear();
});

it('ignores an offline URL filter and hides offline columns on plain HTTP', async () => {
  security.secure = false;
  try {
    const { router, queryClient } = renderRoute('/requisitions/view?facility=f&offline=true');
    await waitFor(() => expect(searchRequisitions).toHaveBeenCalled());
    expect(router.state.location.search.offline).toBeUndefined();
    expect(screen.queryByText('requisitions.offline.empty-title')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'requisitions.offline.label' }),
    ).not.toBeInTheDocument();
    queryClient.clear();
  } finally {
    security.secure = true;
  }
});

it('uses the loader search once on direct entry', async () => {
  const { queryClient } = renderRoute('/requisitions/view?facility=f');
  await screen.findByText('requisitions.view.empty-title');
  expect(searchRequisitions).toHaveBeenCalledTimes(1);
  queryClient.clear();
});

it('offers granted facilities before nodes resolve and refuses an unrelated linked facility', async () => {
  let finish!: (nodes: never[]) => void;
  vi.mocked(fetchUserRecord).mockResolvedValueOnce({
    id: 'u',
    roleAssignments: [{ roleId: 'r', programId: 'p', supervisoryNodeId: 'n' }],
  } as never);
  vi.mocked(fetchRoles).mockResolvedValueOnce([
    { id: 'r', rights: [{ name: 'REQUISITION_VIEW' }] },
  ] as never);
  vi.mocked(fetchSupervisoryNodesByIds).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { queryClient } = renderRoute('/requisitions/view?facility=unrelated');
  expect(await screen.findByRole('button', { name: 'facility-program.search' })).toBeEnabled();
  expect(screen.queryByText('requisitions.view.refused-title')).not.toBeInTheDocument();
  expect(searchRequisitions).not.toHaveBeenCalled();
  await act(async () => finish([]));
  await screen.findByText('requisitions.view.refused-title');
  expect(searchRequisitions).not.toHaveBeenCalled();
  queryClient.clear();
});

it('merges partner facilities after nodes arrive without clearing their linked program', async () => {
  let finish!: (nodes: never[]) => void;
  vi.mocked(fetchUserRecord).mockResolvedValueOnce({
    id: 'u',
    roleAssignments: [{ roleId: 'r', programId: 'p', supervisoryNodeId: 'n' }],
  } as never);
  vi.mocked(fetchRoles).mockResolvedValueOnce([
    { id: 'r', rights: [{ name: 'REQUISITION_VIEW' }] },
  ] as never);
  vi.mocked(fetchSupervisoryNodesByIds)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce([{ id: 'partner-node', requisitionGroup: { id: 'g' } }] as never);
  vi.mocked(fetchRequisitionGroup).mockResolvedValueOnce({
    id: 'g',
    memberFacilities: [
      {
        id: 'partner',
        name: 'Partner',
        supportedPrograms: [{ id: 'partner-program', name: 'Partner program' }],
      },
    ],
  } as never);
  const { router, queryClient } = renderRoute(
    '/requisitions/view?facility=partner&program=partner-program',
  );
  expect(await screen.findByRole('button', { name: 'facility-program.search' })).toBeEnabled();
  expect(searchRequisitions).not.toHaveBeenCalled();
  await act(async () => finish([{ id: 'n', partnerNodeOf: { id: 'partner-node' } }] as never));
  await waitFor(() =>
    expect(searchRequisitions).toHaveBeenCalledWith(
      expect.objectContaining({ facility: 'partner', program: 'partner-program' }),
    ),
  );
  expect(router.state.location.search.program).toBe('partner-program');
  expect(screen.queryByText('requisitions.view.refused-title')).not.toBeInTheDocument();
  queryClient.clear();
});

it('applies the drafted facility together with its program chosen in Filters', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    'REQUISITION_VIEW|f|p',
    'REQUISITION_VIEW|other|q',
  ]);
  vi.mocked(fetchPrograms).mockResolvedValue([
    { id: 'p', name: 'Family Planning', code: 'P', active: true },
    { id: 'q', name: 'Other Program', code: 'Q', active: true },
  ]);
  vi.mocked(fetchMinimalFacilities).mockResolvedValue([
    { id: 'f', name: 'Comfort', code: 'HC01', active: true },
    { id: 'other', name: 'Other Facility', code: 'OTHER', active: true },
  ]);
  const { router, queryClient } = renderRoute('/requisitions/view?facility=f');
  await screen.findByText('requisitions.view.empty-title');
  await userEvent.click(screen.getByRole('combobox', { name: 'facility-program.facility' }));
  await userEvent.click(await screen.findByRole('option', { name: /Other Facility/ }));
  await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  await userEvent.click(screen.getByRole('combobox', { name: 'requisitions.filters.program' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Other Program' }));
  expect(router.state.location.search.facility).toBe('f');
  expect(router.state.location.search.program).toBeUndefined();
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'facility-program.search' }));
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ facility: 'other', program: 'q' }),
  );
  expect(searchRequisitions).toHaveBeenCalledWith(
    expect.objectContaining({ facility: 'other', program: 'q' }),
  );
  queryClient.clear();
});

it('offers the whole facility list through virtualization and searches name or code', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(248);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1006 * 36);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(36);
  vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(function (
    this: HTMLElement,
    options: number | ScrollToOptions,
  ) {
    if (typeof options === 'object') this.scrollTop = options.top ?? 0;
    queueMicrotask(() => this.dispatchEvent(new Event('scroll')));
  });
  const facilities = Array.from({ length: 1006 }, (_, index) => ({
    id: `f${index}`,
    name: `Clinic ${String(index).padStart(4, '0')}`,
    code: `C${index}`,
  }));
  vi.mocked(fetchMinimalFacilities).mockResolvedValueOnce(facilities as never);
  vi.mocked(fetchPermissionStrings).mockResolvedValueOnce(
    facilities.map(({ id }) => `REQUISITION_VIEW|${id}|p`),
  );
  renderRoute('/requisitions/view');
  const input = await screen.findByRole('combobox', { name: /facility-program.facility/ });
  await userEvent.click(input);
  expect(document.querySelector('[data-slot=combobox-status]')).toBeNull();
  expect(screen.getAllByRole('option').length).toBeLessThan(30);
  expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-setsize', '1006');
  await act(() => {
    const list = screen.getByRole('listbox');
    list.scrollTop = 1006 * 36 - 248;
    list.dispatchEvent(new Event('scroll'));
  });
  expect(await screen.findByRole('option', { name: /Clinic 1005/ })).toBeInTheDocument();
  await userEvent.clear(input);
  await userEvent.type(input, 'C987');
  await userEvent.click(await screen.findByRole('option', { name: /Clinic 0987/ }));
  await userEvent.click(input);
  const selected = await screen.findByRole('option', { selected: true });
  expect(selected).toHaveTextContent('Clinic 0987');
  expect(selected).toHaveAttribute('aria-setsize', '1006');
  expect(selected).toHaveAttribute('aria-posinset', '988');
  expect(document.querySelector('[data-slot=combobox-status]')).toBeNull();
});

const onlineRows = ['Online Only', 'Saved Copy'].map((name, index) => ({
  id: `r${index}`,
  emergency: false,
  status: 'AUTHORIZED' as const,
  program: { id: 'p', name: 'Family Planning' },
  facility: { id: 'f', name: 'Comfort' },
  processingPeriod: { id: name, name },
}));
function savedCopy() {
  return {
    id: 'r1',
    fetchedAt: 1700000000000,
    single: { record: onlineRows[1] },
  } as unknown as import('@/features/requisitions/lib/offline-copies').RequisitionCopy;
}

it('keeps online results on disconnect until Search requests saved copies', async () => {
  vi.mocked(readCopies).mockResolvedValue([savedCopy()]);
  vi.mocked(searchRequisitions).mockResolvedValue({
    content: onlineRows,
    number: 0,
    size: 10,
    totalElements: 2,
    totalPages: 1,
  });
  vi.mocked(localRequisitions).mockResolvedValue({
    content: [onlineRows[1]],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  const { queryClient } = renderRoute('/requisitions/view?facility=f');
  await screen.findByText('Online Only');
  await act(() => onlineManager.setOnline(false));
  expect(screen.getByText('Online Only')).toBeVisible();
  const actions = screen.getAllByRole('button', { name: 'requisitions.view.action-name' });
  expect(actions[0]).toHaveAttribute('aria-disabled', 'true');
  expect(actions[0]).toHaveAttribute('aria-description', 'offline.unavailable-title');
  expect(actions[1]).not.toHaveAttribute('aria-disabled', 'true');
  expect(localRequisitions).not.toHaveBeenCalled();
  expect(await screen.findByText('requisitions.offline.online-results')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'facility-program.search' }));
  await waitFor(() => expect(localRequisitions).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText('Online Only')).not.toBeInTheDocument());
  expect(screen.getByText('Saved Copy')).toBeVisible();
  expect(localRequisitions).toHaveBeenCalled();
  queryClient.clear();
});

it.each([1200, 390])('shows View and separate removal actions at width %i', async (width) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
  vi.mocked(readCopies).mockResolvedValue([savedCopy()]);
  vi.mocked(removalDecision).mockResolvedValue({ id: 'r1', dirty: true } as never);
  vi.mocked(searchRequisitions).mockResolvedValue({
    content: onlineRows,
    number: 0,
    size: 10,
    totalElements: 2,
    totalPages: 1,
  });
  const { queryClient } = renderRoute('/requisitions/view?facility=f');
  await screen.findByText('Online Only');
  const views = screen.getAllByRole('button', { name: 'requisitions.view.action-name' });
  expect(views).toHaveLength(2);
  const remove = await screen.findByRole('button', { name: 'requisitions.offline.remove' });
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  if (width === 390) expect(remove.closest('[data-card-actions]')).toContainElement(views[1]);
  await userEvent.click(remove);
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    'requisitions.offline.dirty-warning',
  );
  await userEvent.click(screen.getByRole('button', { name: 'dialog.cancel' }));
  await waitFor(() => expect(remove).toHaveFocus());
  queryClient.clear();
});

it('keeps a separate saved batch action next to View offline', async () => {
  vi.mocked(readCopies).mockResolvedValue([
    { ...savedCopy(), batch: { record: onlineRows[1] } } as never,
  ]);
  vi.mocked(searchRequisitions).mockResolvedValue({
    content: onlineRows,
    number: 0,
    size: 10,
    totalElements: 2,
    totalPages: 1,
  });
  const { queryClient } = renderRoute('/requisitions/view?facility=f');
  await screen.findByText('Saved Copy');
  await act(() => onlineManager.setOnline(false));
  const batch = await screen.findByRole('button', { name: /^requisitions.batch.title:/ });
  expect(batch).toHaveAttribute('href', expect.stringContaining('/requisitions/approve/batch'));
  expect(screen.getAllByRole('button', { name: 'requisitions.view.action-name' })).toHaveLength(2);
  queryClient.clear();
});

it('falls back to saved search after retained results are evicted offline', async () => {
  vi.mocked(readCopies).mockResolvedValue([savedCopy()]);
  vi.mocked(searchRequisitions).mockResolvedValue({
    content: onlineRows,
    number: 0,
    size: 10,
    totalElements: 2,
    totalPages: 1,
  });
  vi.mocked(localRequisitions).mockResolvedValue({
    content: [onlineRows[1]],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  const { queryClient } = renderRoute('/requisitions/view?facility=f');
  await screen.findByText('Online Only');
  await act(() => onlineManager.setOnline(false));
  await act(() => queryClient.resetQueries({ queryKey: ['requisitions', 'list'] }));
  await waitFor(() => expect(localRequisitions).toHaveBeenCalled());
  expect(screen.getByText('Saved Copy')).toBeVisible();
  queryClient.clear();
});

it('cold starts saved View results without downloaded picker references', async () => {
  const saved = { ...savedCopy(), summary: onlineRows[1] };
  vi.mocked(readCopies).mockResolvedValue([saved]);
  vi.mocked(fetchMinimalFacilities).mockRejectedValueOnce(new Error('No facilities downloaded'));
  vi.mocked(fetchUserPrograms).mockRejectedValueOnce(new Error('No programs downloaded'));
  vi.mocked(localRequisitions).mockResolvedValue({
    content: [onlineRows[1]],
    number: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  await act(() => onlineManager.setOnline(false));
  const { queryClient } = renderRoute('/requisitions/view?facility=f&program=p&offline=true');
  expect(await screen.findByText('Saved Copy')).toBeVisible();
  expect(searchRequisitions).not.toHaveBeenCalled();
  expect(fetchMinimalFacilities).not.toHaveBeenCalled();
  queryClient.clear();
});
