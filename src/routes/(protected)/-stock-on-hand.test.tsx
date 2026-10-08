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
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchLotsByIds,
  fetchMinimalFacilities,
  fetchOrderablesByIds,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import { fetchStockCardSummaries, fetchStockOnHandReport } from '@/features/stock-on-hand/api/api';
import type { StockCardSummary } from '@/features/stock-on-hand/lib/types';
import { downloadFile } from '@/lib/download-file';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { Route } from '@/routes/(protected)/_protected.stock-management.stock-on-hand';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchMinimalFacilities: vi.fn(),
  fetchOrderablesByIds: vi.fn(),
  fetchLotsByIds: vi.fn(),
}));
vi.mock('@/features/stock-on-hand/api/api', () => ({
  fetchStockCardSummaries: vi.fn(),
  fetchStockOnHandReport: vi.fn(),
}));
vi.mock('@/lib/download-file', () => ({ downloadFile: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const USER = 'a337ec45-31a0-4f2b-9b2e-a105c4b669bb';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const BALAKA = '13037147-1769-4735-90a7-b9b310d128b8';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const EM = '10845cb9-d365-4aaa-badd-b4fa39c6a26a';

const grants = [`STOCK_CARDS_VIEW|${HOME}|${FP}`, `STOCK_CARDS_VIEW|${BALAKA}|${EM}`];

const summary: StockCardSummary = {
  orderable: { id: 'o1' },
  stockOnHand: 170,
  canFulfillForMe: [
    {
      stockCard: { id: 'c1' },
      orderable: { id: 'o1' },
      lot: { id: 'l1' },
      stockOnHand: 90,
      occurredDate: '2017-05-26',
      active: true,
    },
    {
      stockCard: { id: 'c2' },
      orderable: { id: 'o1' },
      lot: null,
      stockOnHand: 80,
      occurredDate: '2017-05-26',
      active: false,
    },
  ],
};

const page = (content: StockCardSummary[]) => ({
  content,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
  number: 0,
  size: 10,
});

const appQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

function renderRoute(path: string, queryClient = appQueryClient(), pendingMs?: number) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const page = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/stock-on-hand',
    validateSearch: Route.options.validateSearch as never,
    loaderDeps: Route.options.loaderDeps as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
    pendingComponent: Route.options.pendingComponent as never,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([page] as never)] as never),
    ] as never),
    context: { queryClient },
    defaultPendingMs: pendingMs,
    history: createMemoryHistory({ initialEntries: [path] }),
  } as never) as AnyRouter;
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient, unmount: view.unmount };
}

const appliedPath = (facility = HOME, program = FP, mode = 'my', extra = '') =>
  `/stock-management/stock-on-hand?mode=${mode}&programId=${program}&facilityId=${facility}${extra}`;

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
  vi.mocked(fetchOrderablesByIds).mockResolvedValue([
    {
      id: 'o1',
      productCode: 'C1',
      fullProductName: 'Levonorgestrel',
      description: null,
      netContent: 16,
    },
  ]);
  vi.mocked(fetchLotsByIds).mockResolvedValue([
    { id: 'l1', lotCode: 'LOT-A', expirationDate: '2027-01-31' },
  ]);
  vi.mocked(fetchStockCardSummaries).mockResolvedValue(page([summary]));
});

afterEach(() => {
  useLoginData.setState({ referenceDataUserId: null });
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('stock on hand page', () => {
  it('shows the picker and asks for nothing about stock before a search', async () => {
    renderRoute('/stock-management/stock-on-hand');

    expect(await screen.findByText('stock-on-hand.pick-title')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /facility-program.my-facility/ })).toBeChecked();
    expect(fetchStockCardSummaries).not.toHaveBeenCalled();
  });

  it('lays out the results while a searched link loads, before the picker has its options', async () => {
    vi.mocked(fetchMinimalFacilities).mockReturnValue(new Promise(() => {}));
    renderRoute(appliedPath(HOME, FP, 'my', '&productCode=C1'), undefined, 0);

    const filter = await screen.findByRole('button', { name: /stock-on-hand.filter/ });
    expect(filter).toBeDisabled();
    expect(filter).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'stock-on-hand.print' })).toBeDisabled();
    expect(screen.getAllByText('stock-on-hand.lot-code')).not.toHaveLength(0);
  });

  it('lays out only the picker while a page with no search loads', async () => {
    vi.mocked(fetchMinimalFacilities).mockReturnValue(new Promise(() => {}));
    renderRoute('/stock-management/stock-on-hand', undefined, 0);

    expect(await screen.findByText('facility-program.mode')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stock-on-hand.filter/ })).not.toBeInTheDocument();
  });

  it('keeps a product folded away after the page is opened again', async () => {
    const user = userEvent.setup();
    const first = renderRoute(appliedPath());

    await screen.findByText('LOT-A');
    await user.click(screen.getByRole('button', { name: 'stock-on-hand.toggle-product' }));
    await waitFor(() => expect(screen.queryByText('LOT-A')).not.toBeInTheDocument());
    first.unmount();
    renderRoute(appliedPath());

    expect(await screen.findAllByText('Levonorgestrel')).not.toHaveLength(0);
    expect(screen.queryByText('LOT-A')).not.toBeInTheDocument();
  });

  it('lists products in a table at every width, keeping the core columns on a phone', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 390,
    } as DOMRect);
    renderRoute(appliedPath());

    const table = await screen.findByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'stock-on-hand.product-code',
      'stock-on-hand.product',
      'stock-on-hand.lot-code',
      'stock-on-hand.stock-on-hand',
      'stock-on-hand.actions',
    ]);
  });

  it('keeps the table on a laptop, hiding the columns there is no room for', async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
    } as DOMRect);
    renderRoute(appliedPath());

    const table = await screen.findByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toContain('stock-on-hand.pack-size');
    expect(headers).not.toContain('stock-on-hand.expiry-date');
    expect(headers).not.toContain('stock-on-hand.last-update');

    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'stock-on-hand.last-update' }),
    );
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toContain('stock-on-hand.last-update');
  });

  it('shows a dash for an empty value in a lot row', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1200,
    } as DOMRect);
    renderRoute(appliedPath());

    const lot = (await screen.findAllByText('stock-on-hand.no-lot'))[0]?.closest('tr');
    expect(lot && within(lot).getAllByText(EMPTY_VALUE)).not.toHaveLength(0);
  });

  it('opens a searched link on its products, each with its cards', async () => {
    renderRoute(appliedPath());

    expect(await screen.findAllByText('Levonorgestrel')).not.toHaveLength(0);
    expect(screen.getByText('LOT-A')).toBeInTheDocument();
    expect(screen.getByText('stock-on-hand.no-lot')).toBeInTheDocument();
    expect(fetchStockCardSummaries).toHaveBeenCalledWith({
      facilityId: HOME,
      programId: FP,
      nonEmptyOnly: true,
      page: 0,
      size: 10,
    });
    expect(fetchOrderablesByIds).toHaveBeenCalledWith(['o1']);
    expect(fetchLotsByIds).toHaveBeenCalledWith(['l1']);
  });

  it('opens a supervised home-only program link as my facility and lists stock', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([`STOCK_CARDS_VIEW|${HOME}|${FP}`]);
    vi.mocked(fetchUserPrograms).mockResolvedValue([
      { id: FP, code: 'PRG001', name: 'Family Planning', active: true },
    ]);
    renderRoute(appliedPath(HOME, FP, 'supervised'));

    expect(await screen.findAllByText('Levonorgestrel')).not.toHaveLength(0);
    expect(screen.getByRole('radio', { name: /facility-program.my-facility/ })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /facility-program.program/ })).toHaveValue(
      'Family Planning',
    );
    expect(screen.queryByText('stock-on-hand.refused-title')).not.toBeInTheDocument();
    expect(fetchStockCardSummaries).toHaveBeenCalledWith({
      facilityId: HOME,
      programId: FP,
      nonEmptyOnly: true,
      page: 0,
      size: 10,
    });
  });

  it('refuses a link to a facility and program the right is not granted for, asking for no stock', async () => {
    renderRoute(appliedPath(BALAKA, FP, 'supervised'));

    expect(await screen.findByText('stock-on-hand.refused-title')).toBeInTheDocument();
    expect(fetchStockCardSummaries).not.toHaveBeenCalled();
  });

  it('refuses my facility at another facility, even where the right is granted', async () => {
    renderRoute(appliedPath(BALAKA, EM, 'my'));

    expect(await screen.findByText('stock-on-hand.refused-title')).toBeInTheDocument();
    expect(screen.queryByText('Levonorgestrel')).not.toBeInTheDocument();
  });

  it('asks for no stock when another user signs in while the rights load', async () => {
    let releaseRights = () => {};
    vi.mocked(fetchPermissionStrings).mockImplementation((userId) =>
      userId === USER
        ? new Promise((resolve) => {
            releaseRights = () => resolve(grants);
          })
        : Promise.resolve([]),
    );
    renderRoute(appliedPath());

    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalledWith(USER));
    act(() => useLoginData.setState({ referenceDataUserId: 'someone-else' }));
    await act(async () => releaseRights());

    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalledWith('someone-else'));
    expect(fetchStockCardSummaries).not.toHaveBeenCalled();
  });

  it('asks for the stock of a granted link, then its names, while the picker is still loading', async () => {
    vi.mocked(fetchMinimalFacilities).mockReturnValue(new Promise(() => {}));
    renderRoute(appliedPath());

    await waitFor(() => expect(fetchOrderablesByIds).toHaveBeenCalledWith(['o1']));
    expect(fetchLotsByIds).toHaveBeenCalledWith(['l1']);
  });

  it('keeps the page closed to a user without the right', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(['USERS_MANAGE']);
    const { router } = renderRoute(appliedPath());

    await waitFor(() => expect(router.state.matches.at(-1)?.status).toBe('error'));
    expect(fetchStockCardSummaries).not.toHaveBeenCalled();
  });

  it('searches the picked facility and program, keeping them in the address', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/stock-management/stock-on-hand');

    await user.click(await screen.findByRole('combobox', { name: /facility-program.program/ }));
    await user.click(screen.getByRole('option', { name: 'Family Planning' }));
    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));

    expect(await screen.findAllByText('Levonorgestrel')).not.toHaveLength(0);
    expect(router.state.location.search).toMatchObject({
      mode: 'my',
      programId: FP,
      facilityId: HOME,
    });
  });

  it('hides the results for a picked selection until it is searched', async () => {
    const user = userEvent.setup();
    renderRoute(appliedPath());

    await screen.findAllByText('Levonorgestrel');
    await user.click(screen.getByRole('radio', { name: /facility-program.supervised-facility/ }));

    expect(screen.queryAllByText('Levonorgestrel')).toHaveLength(0);
    expect(screen.getByText('stock-on-hand.search-pending-title')).toBeInTheDocument();
  });

  it('filters from a popover that counts the filters in use, each cleared by its own button', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(appliedPath(HOME, FP, 'my', '&productCode=C1&lotCode=L'));

    const filter = await screen.findByRole('button', { name: /stock-on-hand.filter/ });
    expect(filter).toHaveTextContent('2');
    expect(filter).toHaveAccessibleName('stock-on-hand.filter stock-on-hand.active-filters');
    await user.click(filter);
    expect(await screen.findByRole('dialog', { name: 'stock-on-hand.filter' })).toBeInTheDocument();
    expect(
      await screen.findByRole('textbox', { name: 'stock-on-hand.search-product-code' }),
    ).toHaveValue('C1');
    expect(
      screen.queryByRole('button', { name: 'stock-on-hand.clear-filters' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear Search' })[0] as HTMLElement);

    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('productCode'));
    expect(router.state.location.search).toMatchObject({ lotCode: 'L' });
    expect(filter).toHaveTextContent('1');
  });

  it('hides inactive cards without asking the server again', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(appliedPath());

    await screen.findByText('stock-on-hand.no-lot');
    await user.click(screen.getByRole('button', { name: /stock-on-hand.filter/ }));
    await user.click(
      await screen.findByRole('checkbox', { name: 'stock-on-hand.include-inactive' }),
    );

    await waitFor(() => expect(screen.queryByText('stock-on-hand.no-lot')).not.toBeInTheDocument());
    expect(screen.getByText('LOT-A')).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ includeInactive: false });
    expect(fetchStockCardSummaries).toHaveBeenCalledTimes(1);
  });

  it('stops showing the rows once the right is taken away there', async () => {
    const { queryClient } = renderRoute(appliedPath());

    await screen.findAllByText('Levonorgestrel');
    vi.mocked(fetchPermissionStrings).mockResolvedValue([`STOCK_CARDS_VIEW|${BALAKA}|${EM}`]);
    await act(() => queryClient.refetchQueries({ queryKey: permissionsOptions(USER).queryKey }));

    await waitFor(() => expect(screen.queryAllByText('Levonorgestrel')).toHaveLength(0));
    expect(screen.getByText('stock-on-hand.refused-title')).toBeInTheDocument();
  });

  it('says no products were found when the facility has no stock cards', async () => {
    vi.mocked(fetchStockCardSummaries).mockResolvedValue(page([]));
    renderRoute(appliedPath());

    expect(await screen.findByText('stock-on-hand.no-products')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'stock-on-hand.print' })).toBeDisabled();
  });

  it('prints the whole facility and program in the unit shown', async () => {
    const user = userEvent.setup();
    const report = new Blob(['%PDF']);
    vi.mocked(fetchStockOnHandReport).mockResolvedValue(report);
    renderRoute(appliedPath());

    const print = await screen.findByRole('button', { name: 'stock-on-hand.print' });
    await waitFor(() => expect(print).toBeEnabled());
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'quantity-unit.label' })).getByRole('radio', {
        name: 'quantity-unit.packs',
      }),
    );
    await user.click(print);

    await waitFor(() =>
      expect(downloadFile).toHaveBeenCalledWith(report, 'stock-on-hand-HC01-PRG001.pdf'),
    );
    expect(fetchStockOnHandReport).toHaveBeenCalledWith(
      expect.objectContaining({ programId: FP, facilityId: HOME, showInDoses: false }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('keeps the last results hidden while a newly searched selection loads', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(appliedPath());

    await screen.findAllByText('Levonorgestrel');
    let releaseStock = () => {};
    vi.mocked(fetchStockCardSummaries).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseStock = () => resolve(page([summary]));
        }),
    );
    await user.click(screen.getByRole('radio', { name: /facility-program.supervised-facility/ }));
    await user.click(screen.getByRole('combobox', { name: /facility-program.program/ }));
    await user.click(screen.getByRole('option', { name: 'Essential Meds' }));
    await user.click(screen.getByRole('combobox', { name: /facility-program.facility/ }));
    await user.click(await screen.findByRole('option', { name: /Balaka District Hospital/ }));
    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));

    await waitFor(() =>
      expect(router.state.resolvedLocation?.search).toMatchObject({ programId: EM }),
    );
    expect(screen.queryAllByText('Levonorgestrel')).toHaveLength(0);
    await act(async () => releaseStock());
    expect(await screen.findAllByText('Levonorgestrel')).not.toHaveLength(0);
  });

  it('shows each balance in packs once packs are picked', async () => {
    const user = userEvent.setup();
    renderRoute(appliedPath());

    await screen.findAllByText('Levonorgestrel');
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'quantity-unit.label' })).getByRole('radio', {
        name: 'quantity-unit.packs',
      }),
    );

    expect(screen.getByText('5 ( +10 )')).toBeInTheDocument();
    expect(screen.getByText('10 ( +10 )')).toBeInTheDocument();
    expect(screen.getByText('5 ( +0 )')).toBeInTheDocument();
  });

  it('goes back to the last page when the page asked for is past the end', async () => {
    vi.mocked(fetchStockCardSummaries).mockImplementation(async ({ page: number }) =>
      number === 0
        ? page([summary])
        : { content: [], totalElements: 1, totalPages: 1, number, size: 10 },
    );
    const { router } = renderRoute(appliedPath(HOME, FP, 'my', '&page=4'));

    await screen.findAllByText('Levonorgestrel');
    expect(router.state.location.search).not.toHaveProperty('page');
  });

  it('explains a page left empty by hiding inactive items, and offers them back', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStockCardSummaries).mockResolvedValue(
      page([
        {
          ...summary,
          canFulfillForMe: summary.canFulfillForMe.map((card) => ({ ...card, active: false })),
        },
      ]),
    );
    const { router } = renderRoute(appliedPath(HOME, FP, 'my', '&includeInactive=false'));

    expect(await screen.findByText('stock-on-hand.inactive-only-title')).toBeInTheDocument();
    await user.click(
      screen.getAllByRole('button', { name: 'stock-on-hand.include-inactive' })[0] as HTMLElement,
    );

    expect(await screen.findAllByText('Levonorgestrel')).not.toHaveLength(0);
    expect(router.state.location.search).not.toHaveProperty('includeInactive');
  });

  it('tells the user when printing fails, with the server message', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStockOnHandReport).mockRejectedValue(
      httpError(403, { message: 'Permission check failed.' }),
    );
    renderRoute(appliedPath());

    const print = await screen.findByRole('button', { name: 'stock-on-hand.print' });
    await waitFor(() => expect(print).toBeEnabled());
    await user.click(print);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('stock-on-hand.print-error-title', {
        description: 'Permission check failed.',
      }),
    );
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('drops a report that arrives after another user signed in', async () => {
    const user = userEvent.setup();
    let releaseReport = (_report: Blob) => {};
    vi.mocked(fetchStockOnHandReport).mockReturnValue(
      new Promise((resolve) => {
        releaseReport = resolve;
      }),
    );
    const { queryClient } = renderRoute(appliedPath());

    const print = await screen.findByRole('button', { name: 'stock-on-hand.print' });
    await waitFor(() => expect(print).toBeEnabled());
    await user.click(print);
    await waitFor(() => expect(fetchStockOnHandReport).toHaveBeenCalled());
    act(() => {
      queryClient.clear();
      useLoginData.setState({ referenceDataUserId: 'someone-else' });
    });
    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalledWith('someone-else'));
    expect(await screen.findAllByText('Levonorgestrel')).not.toHaveLength(0);
    await act(async () => releaseReport(new Blob(['%PDF'])));

    expect(downloadFile).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('keeps a server failure in plain words when printing fails', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStockOnHandReport).mockRejectedValue(
      httpError(500, { message: 'Index: 0, Size: 0' }),
    );
    renderRoute(appliedPath());

    const print = await screen.findByRole('button', { name: 'stock-on-hand.print' });
    await waitFor(() => expect(print).toBeEnabled());
    await user.click(print);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('stock-on-hand.print-error-title', {
        description: 'stock-on-hand.print-error',
      }),
    );
  });

  it('refuses to print once the right is gone, without asking for the report', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderRoute(appliedPath());

    const print = await screen.findByRole('button', { name: 'stock-on-hand.print' });
    await waitFor(() => expect(print).toBeEnabled());
    vi.mocked(fetchPermissionStrings).mockResolvedValue([`STOCK_CARDS_VIEW|${BALAKA}|${EM}`]);
    queryClient
      .getQueryCache()
      .find({ queryKey: permissionsOptions(USER).queryKey })
      ?.invalidate();
    await user.click(print);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('stock-on-hand.print-error-title', {
        description: 'stock-on-hand.print-refused',
      }),
    );
    expect(fetchStockOnHandReport).not.toHaveBeenCalled();
  });

  it('shows the earlier results again after Back from a newer search', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(appliedPath());

    await screen.findAllByText('Levonorgestrel');
    await user.click(screen.getByRole('radio', { name: /facility-program.supervised-facility/ }));
    await user.click(screen.getByRole('combobox', { name: /facility-program.program/ }));
    await user.click(screen.getByRole('option', { name: 'Essential Meds' }));
    await user.click(screen.getByRole('combobox', { name: /facility-program.facility/ }));
    await user.click(await screen.findByRole('option', { name: /Balaka District Hospital/ }));
    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ programId: EM }));
    await screen.findAllByText('Levonorgestrel');

    let hidden = false;
    const watch = new MutationObserver(() => {
      if (screen.queryByText('stock-on-hand.search-pending-title')) hidden = true;
    });
    watch.observe(document.body, { childList: true, subtree: true });
    await act(() => router.history.back());

    await waitFor(() =>
      expect(router.state.resolvedLocation?.search).toMatchObject({ programId: FP }),
    );
    await waitFor(() => expect(router.state.status).toBe('idle'));
    watch.disconnect();
    expect(hidden).toBe(false);
    expect(screen.getAllByText('Levonorgestrel')).not.toHaveLength(0);
  });
});

describe('stock on hand View', () => {
  it.each([768, 839, 1009])('keeps the table at the original content width %i', async (width) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
    renderRoute(appliedPath());
    await screen.findAllByText('Levonorgestrel');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'stock-on-hand.view-card' })).toHaveLength(2);
  });

  it.each([1200, 390])(
    'offers View only for existing cards at content width %i and keeps the whole search',
    async (width) => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        width,
      } as DOMRect);
      vi.mocked(fetchStockCardSummaries).mockResolvedValue(
        page([
          {
            ...summary,
            canFulfillForMe: [
              ...summary.canFulfillForMe,
              {
                orderable: { id: 'o1' },
                stockOnHand: 0,
                occurredDate: null,
                active: true,
                stockCard: null,
                lot: null,
              },
            ],
          },
        ]),
      );
      renderRoute(
        appliedPath(HOME, FP, 'my', '&page=2&size=20&productCode=C1&productName=Levo&lotCode=LOT'),
      );
      await screen.findAllByText('Levonorgestrel');
      const view = screen.getAllByRole('button', { name: 'stock-on-hand.view-card' });
      expect(view).toHaveLength(2);
      const urls = view.map((link) => new URL((link as HTMLAnchorElement).href));
      expect(urls.map((url) => url.pathname).sort()).toEqual([
        '/stock-management/stock-on-hand/c1',
        '/stock-management/stock-on-hand/c2',
      ]);
      for (const url of urls) {
        expect(Object.fromEntries(url.searchParams)).toEqual({
          mode: 'my',
          facilityId: HOME,
          programId: FP,
          page: '2',
          size: '20',
          productCode: 'C1',
          productName: 'Levo',
          lotCode: 'LOT',
        });
      }
    },
  );
});
