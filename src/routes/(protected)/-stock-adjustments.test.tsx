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
import { ErrorFallback } from '@/components/error-fallback';
import { canOpen } from '@/components/nav-access';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchFacility,
  fetchUserPrograms,
  fetchUserRecord,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import type { Facility } from '@/features/reference-data/lib/types';
import { fetchEventStockCards } from '@/features/stock-events/api/api';
import { Route as PickerRoute } from '@/routes/(protected)/_protected.stock-management.adjustments';
import { Route as EditorRoute } from '@/routes/(protected)/_protected.stock-management.adjustments_.$programId';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchFacility: vi.fn(),
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchValidReasons: vi.fn(),
}));

vi.mock('@/features/stock-events/api/api', () => ({
  fetchEventStockCards: vi.fn(),
  submitStockEvent: vi.fn(),
}));

const USER = 'a337ec45-31a0-4f2b-9b2e-a105c4b669bb';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const EM = '10845cb9-d365-4aaa-badd-b4fa39c6a26a';
const PICKER = '/stock-management/adjustments';
const grants = [`STOCK_ADJUST|${HOME}|${FP}`, `STOCK_ADJUST|${HOME}|${EM}`];
const programs = [
  { id: FP, code: 'PRG001', name: 'Family Planning', active: true },
  { id: EM, code: 'PRG002', name: 'Essential Meds', active: true },
];
const homeFacility: Facility = {
  id: HOME,
  code: 'HC01',
  name: 'Comfort Health Clinic',
  active: true,
  enabled: true,
  type: { id: 'type', code: 'HC', name: 'Health Center' },
  geographicZone: { id: 'zone', code: 'Neno', name: 'Neno', level: { name: 'District' } },
  supportedPrograms: programs.map((program) => ({
    ...program,
    supportActive: true,
    supportLocallyFulfilled: false,
  })),
};

function renderRoute(path = PICKER) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const picker = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/adjustments',
    loader: PickerRoute.options.loader as never,
    component: PickerRoute.options.component as never,
    pendingComponent: PickerRoute.options.pendingComponent as never,
  });
  const editor = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/adjustments/$programId',
    validateSearch: EditorRoute.options.validateSearch as never,
    loader: EditorRoute.options.loader as never,
    component: EditorRoute.options.component as never,
    pendingComponent: EditorRoute.options.pendingComponent as never,
    staticData: EditorRoute.options.staticData,
  }).update({ id: '/stock-management/adjustments_/$programId' } as never);
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([picker, editor] as never)] as never),
    ] as never),
    context: { queryClient },
    defaultErrorComponent: ErrorFallback,
    history: createMemoryHistory({ initialEntries: [path] }),
  } as never) as AnyRouter;
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient, ...view };
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.mocked(fetchEventStockCards).mockResolvedValue([]);
  vi.mocked(fetchValidReasons).mockResolvedValue([]);
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
  vi.mocked(fetchUserPrograms).mockResolvedValue(programs);
  vi.mocked(fetchFacility).mockResolvedValue(homeFacility);
});

afterEach(() => useLoginData.setState({ referenceDataUserId: null }));

describe('adjustments program picker', () => {
  it('lists granted home programs by name and links to their editors', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute();

    const table = await screen.findByRole('table');
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual(['Essential Medsstock-adjustment.make', 'Family Planningstock-adjustment.make']);
    const row = screen.getByText('Essential Meds').closest('tr') as HTMLElement;
    const link = within(row).getByRole('link', { name: 'stock-adjustment.make' });
    expect(link).toHaveAttribute('href', `${PICKER}/${EM}`);
    await user.click(link);

    expect(
      await screen.findByRole('heading', { name: 'stock-adjustment.editor-title' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`${PICKER}/${EM}`);
    expect(fetchFacility).toHaveBeenCalledWith(HOME);
  });

  it('refuses the page before fetching lookups when the right is absent', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(['STOCK_CARDS_VIEW']);
    renderRoute();

    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(fetchUserRecord).not.toHaveBeenCalled();
    expect(fetchUserPrograms).not.toHaveBeenCalled();
    expect(fetchFacility).not.toHaveBeenCalled();
  });

  it('hides the navigation entry without the adjustment right', () => {
    expect(canOpen(PICKER, undefined)).toBe(false);
    expect(canOpen(PICKER, new Set(['STOCK_CARDS_VIEW']))).toBe(false);
    expect(canOpen(PICKER, new Set(['STOCK_ADJUST']))).toBe(true);
  });

  it('shows the no-home message without asking for a facility', async () => {
    vi.mocked(fetchUserRecord).mockResolvedValue({
      id: USER,
      username: 'administrator',
      firstName: 'Admin',
      lastName: 'Istrator',
      active: true,
      homeFacilityId: null,
      roleAssignments: [],
    });
    renderRoute();

    expect(await screen.findByText('facility-program.no-home')).toBeInTheDocument();
    expect(fetchFacility).not.toHaveBeenCalled();
  });

  it('shows a retryable load error inside the page', async () => {
    vi.mocked(fetchFacility).mockRejectedValueOnce(new Error('Unavailable'));
    const user = userEvent.setup();
    renderRoute();

    expect(await screen.findByText('stock-programs.load-error-title')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Family Planning')).toBeInTheDocument();
  });

  it('renders the heading and loading table while the facility request is pending', async () => {
    vi.mocked(fetchFacility).mockReturnValue(new Promise(() => {}));
    renderRoute();

    expect(
      await screen.findByRole('heading', { name: 'nav.stock-management.adjustments' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('Essential Meds')).not.toBeInTheDocument();
  });
});

describe('adjustment editor access', () => {
  it('removes old lines while new rights are pending and loads a fresh draft for the same facility', async () => {
    const rights = [...grants, `STOCK_CARDS_VIEW|${HOME}|${FP}`];
    vi.mocked(fetchPermissionStrings).mockResolvedValue(rights);
    vi.mocked(fetchEventStockCards).mockResolvedValue([
      {
        stockOnHand: 50,
        orderable: { id: 'product', productCode: 'C1', fullProductName: 'Aspirin', netContent: 16 },
        lot: null,
      },
    ]);
    const user = userEvent.setup();
    renderRoute(`${PICKER}/${FP}`);
    await user.click(await screen.findByRole('combobox', { name: 'stock-events.product' }));
    await user.click(await screen.findByRole('option', { name: 'Aspirin' }));
    await user.click(screen.getByRole('button', { name: 'stock-events.add' }));
    const quantity = document.querySelector('[name="lines[0].quantity.doses"]') as HTMLInputElement;
    expect(quantity).toBeInTheDocument();
    await user.type(quantity, '65');
    let finish!: (permissions: string[]) => void;
    vi.mocked(fetchPermissionStrings).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    expect(quantity).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'stock-events.submit' })).not.toBeInTheDocument();
    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalledWith('other'));
    await act(async () => finish(rights));
    await screen.findByRole('heading', { name: 'stock-adjustment.editor-title' });
    expect(document.querySelector('[name="lines[0].quantity.doses"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled();
  });

  it('drops the old loader scope and rechecks rights after a user change', async () => {
    renderRoute(`${PICKER}/${FP}`);
    await screen.findByRole('heading', { name: 'stock-adjustment.editor-title' });
    vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    expect(
      screen.queryByRole('heading', { name: 'stock-adjustment.editor-title' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalledWith('other'));
  });

  it('explains missing scoped stock view access without loading stock cards', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([...grants, `STOCK_CARDS_VIEW|away|${FP}`]);
    renderRoute(`${PICKER}/${FP}`);
    expect(await screen.findByText('stock-events.no-stock-view-description')).toBeInTheDocument();
    expect(fetchEventStockCards).not.toHaveBeenCalled();
    expect(fetchValidReasons).not.toHaveBeenCalled();
  });
  it('prefetches stock and reasons for the granted home facility and program', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([
      ...grants,
      `STOCK_CARDS_VIEW|${HOME}|${FP}`,
    ]);
    renderRoute(`${PICKER}/${FP}`);
    await screen.findByRole('heading', { name: 'stock-adjustment.editor-title' });
    expect(fetchEventStockCards).toHaveBeenCalledWith({ facilityId: HOME, programId: FP });
    expect(fetchValidReasons).toHaveBeenCalledWith({ program: FP, facilityType: 'type' });
  });

  it.each([
    ['an unscoped right', ['STOCK_ADJUST']],
    ['a grant at another facility', [`STOCK_ADJUST|away|${FP}`]],
    ['a grant for another program', [`STOCK_ADJUST|${HOME}|${EM}`]],
  ])('shows No Access for %s', async (_name, permissions) => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(permissions);
    renderRoute(`${PICKER}/${FP}`);

    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(screen.queryByText('stock-adjustment.editor-title')).not.toBeInTheDocument();
  });

  it('shows No Access for a program the home facility does not support', async () => {
    vi.mocked(fetchFacility).mockResolvedValue({ ...homeFacility, supportedPrograms: [] });
    renderRoute(`${PICKER}/${FP}`);

    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
  });

  it('shows No Access without a home facility', async () => {
    vi.mocked(fetchUserRecord).mockResolvedValue({
      id: USER,
      username: 'administrator',
      firstName: 'Admin',
      lastName: 'Istrator',
      active: true,
      homeFacilityId: null,
      roleAssignments: [],
    });
    renderRoute(`${PICKER}/${FP}`);

    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(fetchFacility).not.toHaveBeenCalled();
  });

  it('keeps valid paging and keyword state in the URL', async () => {
    const { router } = renderRoute(`${PICKER}/${FP}?page=2&size=20&keyword=lot`);

    await screen.findByRole('heading', { name: 'stock-adjustment.editor-title' });
    expect(router.state.location.search).toMatchObject({ page: 2, size: 20, keyword: 'lot' });
  });

  it('drops invalid paging and blank keywords to their defaults', async () => {
    const { router } = renderRoute(`${PICKER}/${FP}?page=-1&size=17&keyword=%20`);

    await screen.findByRole('heading', { name: 'stock-adjustment.editor-title' });
    const search = router.state.matches.at(-1)?.search;
    expect(search).toEqual({ page: undefined, size: undefined });
  });

  it('leaves default paging and an empty keyword out of navigation links', async () => {
    const { router } = renderRoute(`${PICKER}/${FP}`);
    await screen.findByRole('heading', { name: 'stock-adjustment.editor-title' });

    await act(() =>
      router.navigate({
        to: '/stock-management/adjustments/$programId',
        params: { programId: FP },
        search: { page: 1, size: 10, keyword: '' },
      }),
    );

    expect(router.state.location.searchStr).toBe('');
  });
});
