import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchMinimalFacilities,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import { fetchStockEvents } from '@/features/stock-events/api/api';
import type { StockEventSummary } from '@/features/stock-events/lib/types';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { Route } from '@/routes/(protected)/_protected.stock-management.transaction-history';
import { httpError, networkError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchDeploymentTimeZone: vi.fn(async () => 'Pacific/Auckland'),
  storedTimeZone: vi.fn(() => null),
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchMinimalFacilities: vi.fn(),
}));
vi.mock('@/features/stock-events/api/api', () => ({ fetchStockEvents: vi.fn() }));

const USER = 'a337ec45-31a0-4f2b-9b2e-a105c4b669bb';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const BALAKA = '13037147-1769-4735-90a7-b9b310d128b8';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const EM = '10845cb9-d365-4aaa-badd-b4fa39c6a26a';
const EVENT = '5eda2982-678a-4b7b-b5d2-cd58d8b18075';

const grants = [`STOCK_CARDS_VIEW|${HOME}|${FP}`, `STOCK_CARDS_VIEW|${BALAKA}|${EM}`];

const event = (overrides: Partial<StockEventSummary> = {}): StockEventSummary => ({
  id: EVENT,
  documentNumber: 'FM71-ISS-1',
  type: 'ISSUE',
  signature: 'Tester',
  occurredDate: '2026-10-07',
  processedDate: '2026-10-07T12:15:00Z',
  entriesCount: 2,
  userId: USER,
  username: 'administrator',
  reversible: true,
  facilityId: HOME,
  programId: FP,
  ...overrides,
});

const page = (content: StockEventSummary[], totalElements = content.length) => ({
  content,
  totalElements,
  totalPages: Math.ceil(totalElements / 10),
  number: 0,
  size: 10,
});

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const list = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/transaction-history',
    validateSearch: Route.options.validateSearch as never,
    loaderDeps: Route.options.loaderDeps as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
    pendingComponent: Route.options.pendingComponent as never,
  });
  const detail = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/transaction-history/$eventId',
    component: () => <p>event detail</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([list, detail] as never)] as never),
    ] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

const appliedPath = (extra = '', facility = HOME, program = FP) =>
  `/stock-management/transaction-history?mode=my&programId=${program}&facilityId=${facility}${extra}`;

const widthOf = (width: number) =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);

const headers = () =>
  within(screen.getByRole('table'))
    .getAllByRole('columnheader')
    .map((header) => header.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: USER });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(grants);
  vi.mocked(fetchUserRecord).mockResolvedValue({
    id: USER,
    username: 'administrator',
    firstName: 'Admin',
    lastName: 'Istrator',
    active: true,
    homeFacilityId: HOME,
    roleAssignments: [],
  });
  vi.mocked(fetchUserPrograms).mockResolvedValue([
    { id: FP, code: 'PRG001', name: 'Family Planning', active: true },
    { id: EM, code: 'PRG002', name: 'Essential Meds', active: true },
  ]);
  vi.mocked(fetchMinimalFacilities).mockResolvedValue([
    { id: HOME, code: 'HC01', name: 'Comfort Health Clinic', active: true },
    { id: BALAKA, code: 'DH01', name: 'Balaka District Hospital', active: true },
  ]);
  vi.mocked(fetchStockEvents).mockResolvedValue(
    page([
      event(),
      event({
        id: 'e2',
        documentNumber: null,
        type: 'RECEIVE',
        signature: null,
        entriesCount: 1,
        processedDate: '2026-10-06T08:00:00Z',
      }),
    ]),
  );
});

afterEach(() => {
  useLoginData.setState({ referenceDataUserId: null });
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('transaction history page', () => {
  it('shows the picker and asks for no events before a search', async () => {
    renderRoute('/stock-management/transaction-history');

    expect(await screen.findByText('transaction-history.pick-title')).toBeInTheDocument();
    expect(fetchStockEvents).not.toHaveBeenCalled();
  });

  it('lets the filters be set before a search, as legacy does, still asking for nothing', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/stock-management/transaction-history');

    await user.click(await screen.findByRole('button', { name: /transaction-history.filter/ }));
    expect(
      screen.queryByText('transaction-history.search-document-number'),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'transaction-history.search-document-number' }),
      'HC01{Enter}',
    );

    await waitFor(() => expect(router.state.location.search).toEqual({ documentNumber: 'HC01' }));
    expect(fetchStockEvents).not.toHaveBeenCalled();
  });

  it('lists the events in the server order with the legacy columns', async () => {
    widthOf(1200);
    renderRoute(appliedPath());

    const first = (await screen.findByText('FM71-ISS-1')).closest('tr');
    expect(headers()).toEqual([
      'transaction-history.document-number',
      'transaction-history.type',
      'transaction-history.date',
      'transaction-history.entries-count',
      'transaction-history.performed-by',
      'transaction-history.signature',
      'transaction-history.actions',
    ]);
    expect(first && within(first).getByText('transaction-history.type-issue')).toBeInTheDocument();
    expect(first && within(first).getByText('Oct 8, 2026')).toBeInTheDocument();
    expect(first && within(first).getByText('administrator')).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(
      within(rows[1] as HTMLElement).getByText('transaction-history.type-receive'),
    ).toBeVisible();
    expect(within(rows[1] as HTMLElement).queryByText(EMPTY_VALUE)).not.toBeInTheDocument();
    const cells = within(rows[1] as HTMLElement).getAllByRole('cell');
    expect(cells[0]?.textContent).toBe('');
    expect(cells[5]?.textContent).toBe('');
    expect(fetchStockEvents).toHaveBeenCalledWith({
      facilityId: HOME,
      programId: FP,
      page: 0,
      size: 20,
    });
  });

  it('sends every filter and the page from the link to the server', async () => {
    renderRoute(
      appliedPath(
        '&type=adjustment&startDate=2026-10-01&endDate=2026-10-31&documentNumber=FM71&page=2',
      ),
    );

    await waitFor(() =>
      expect(fetchStockEvents).toHaveBeenCalledWith({
        facilityId: HOME,
        programId: FP,
        type: 'adjustment',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        documentNumber: 'FM71',
        page: 1,
        size: 20,
      }),
    );
    const filter = await screen.findByRole('button', { name: /transaction-history.filter/ });
    expect(filter).toHaveTextContent('4');
  });

  it('offers All before the types, as legacy, and All clears the type', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(appliedPath('&type=issue'));

    await user.click(await screen.findByRole('button', { name: /transaction-history.filter/ }));
    await user.click(await screen.findByRole('combobox', { name: 'transaction-history.type' }));
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'transaction-history.type-all',
      'transaction-history.type-issue',
      'transaction-history.type-receive',
      'transaction-history.type-adjustment',
    ]);
    await user.click(screen.getByRole('option', { name: 'transaction-history.type-all' }));

    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('type'));
  });

  it('refuses an end date before the start date without asking the server', async () => {
    renderRoute(appliedPath('&startDate=2026-10-10&endDate=2026-10-01'));

    expect(await screen.findByText('transaction-history.date-range-title')).toBeInTheDocument();
    expect(fetchStockEvents).not.toHaveBeenCalled();
  });

  it('clears the dates from the refused range and lists the events', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(
      appliedPath('&type=issue&startDate=2026-10-10&endDate=2026-10-01'),
    );

    await user.click(
      await screen.findByRole('button', { name: 'transaction-history.clear-dates' }),
    );

    expect(await screen.findByText('FM71-ISS-1')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({
      mode: 'my',
      programId: FP,
      facilityId: HOME,
      type: 'issue',
    });
  });

  it('tells no events apart from no matches, and clears the filters', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStockEvents).mockResolvedValue(page([]));
    const { router } = renderRoute(appliedPath('&type=issue'));

    await user.click(
      await screen.findByRole('button', { name: 'transaction-history.clear-filters' }),
    );
    expect(await screen.findByText('transaction-history.no-events-title')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ mode: 'my', programId: FP, facilityId: HOME });
  });

  it('opens an event with the list search, so the way back keeps the filters', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(appliedPath('&type=issue&page=2'));

    const row = (await screen.findByText('FM71-ISS-1')).closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /transaction-history.view/ }));

    expect(await screen.findByText('event detail')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/stock-management/transaction-history/${EVENT}`);
    expect(router.state.location.search).toEqual({
      mode: 'my',
      programId: FP,
      facilityId: HOME,
      type: 'issue',
      page: 2,
    });
  });

  it('opens a supervised home-only program link as my facility and lists events', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([`STOCK_CARDS_VIEW|${HOME}|${FP}`]);
    vi.mocked(fetchUserPrograms).mockResolvedValue([
      { id: FP, code: 'PRG001', name: 'Family Planning', active: true },
    ]);
    renderRoute(appliedPath().replace('mode=my', 'mode=supervised'));

    expect(await screen.findByText('FM71-ISS-1')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /facility-program.my-facility/ })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /facility-program.program/ })).toHaveValue(
      'Family Planning',
    );
    expect(screen.queryByText('transaction-history.refused-title')).not.toBeInTheDocument();
    expect(fetchStockEvents).toHaveBeenCalledWith({
      facilityId: HOME,
      programId: FP,
      page: 0,
      size: 20,
    });
    await userEvent.click(screen.getByRole('button', { name: 'facility-program.search' }));
    await waitFor(() => expect(fetchStockEvents).toHaveBeenCalledTimes(2));
  });

  it('refuses a link to a facility and program the user may not see', async () => {
    renderRoute(appliedPath('', BALAKA, FP));

    expect(await screen.findByText('transaction-history.refused-title')).toBeInTheDocument();
    expect(fetchStockEvents).not.toHaveBeenCalled();
  });

  it('keeps the identifying columns on a phone and offers the rest from the View menu', async () => {
    const user = userEvent.setup();
    widthOf(390);
    renderRoute(appliedPath());

    await screen.findByText('FM71-ISS-1');
    expect(headers()).toEqual([
      'transaction-history.document-number',
      'transaction-history.date',
      'transaction-history.actions',
    ]);
    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'transaction-history.signature' }),
    );
    expect(headers()).toContain('transaction-history.signature');
  });

  it('shows an error with a retry when the events fail to load', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStockEvents).mockRejectedValueOnce(httpError(500));
    renderRoute(appliedPath());

    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('FM71-ISS-1')).toBeInTheDocument();
  });

  it('says the transactions need a connection when the request gets no answer', async () => {
    vi.mocked(fetchStockEvents).mockRejectedValue(networkError());
    renderRoute(appliedPath());

    expect(await screen.findByText('offline.notice-title')).toBeInTheDocument();
  });

  it('opens a filtered page 2 again from its link, as after a reload', async () => {
    vi.mocked(fetchStockEvents).mockResolvedValue({ ...page([event()], 25), number: 1 });
    renderRoute(appliedPath('&type=receive&page=2'));

    expect(await screen.findByText('FM71-ISS-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(fetchStockEvents).toHaveBeenCalledWith({
      facilityId: HOME,
      programId: FP,
      type: 'receive',
      page: 1,
      size: 20,
    });
  });

  it('asks for no events for a user who changed while their rights loaded', async () => {
    let releaseRights = () => {};
    vi.mocked(fetchPermissionStrings).mockReturnValueOnce(
      new Promise((resolve) => {
        releaseRights = () => resolve(grants);
      }),
    );
    renderRoute(appliedPath());

    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalledWith(USER));
    vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
    act(() => useLoginData.setState({ referenceDataUserId: 'someone-else' }));
    await act(async () => releaseRights());

    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalledWith('someone-else'));
    expect(fetchStockEvents).not.toHaveBeenCalled();
  });
});
