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
import { Route } from '@/routes/(protected)/_protected.stock-management.stock-on-hand';

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
  orderable: { id: 'o1', versionNumber: 1 },
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

function renderRoute(path: string, queryClient = new QueryClient()) {
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
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([page] as never)] as never),
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

afterEach(() => useLoginData.setState({ referenceDataUserId: null }));

describe('stock on hand page', () => {
  it('shows the picker and asks for nothing about stock before a search', async () => {
    renderRoute('/stock-management/stock-on-hand');

    expect(await screen.findByText('stock-on-hand.pick-title')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /facility-program.my-facility/ })).toBeChecked();
    expect(fetchStockCardSummaries).not.toHaveBeenCalled();
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

  it('refuses a link to a facility and program the right is not granted for, asking for no stock', async () => {
    renderRoute(appliedPath(BALAKA, FP, 'supervised'));

    expect(await screen.findByText('stock-on-hand.refused-title')).toBeInTheDocument();
    expect(fetchStockCardSummaries).not.toHaveBeenCalled();
  });

  it('refuses my facility at another facility, even where the right is granted', async () => {
    renderRoute(appliedPath(BALAKA, EM, 'my'));

    expect(await screen.findByText('stock-on-hand.refused-title')).toBeInTheDocument();
    expect(fetchStockCardSummaries).not.toHaveBeenCalled();
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

  it('hides inactive cards without asking the server again', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(appliedPath());

    await screen.findByText('stock-on-hand.no-lot');
    await user.click(screen.getByRole('checkbox', { name: 'stock-on-hand.include-inactive' }));

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
      within(screen.getByRole('group', { name: 'quantity-unit.label' })).getByRole('button', {
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
});
