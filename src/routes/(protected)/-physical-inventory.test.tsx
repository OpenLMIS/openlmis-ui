import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
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
import {
  fetchEligibleInventoryProducts,
  fetchInventoryStockLines,
  fetchPhysicalInventoryDraft,
  startPhysicalInventory,
} from '@/features/stock-events/api/physical-inventory-api';
import { Route as ProtectedRoute } from '@/routes/(protected)/_protected';
import { Route as PickerRoute } from '@/routes/(protected)/_protected.stock-management.physical-inventory';
import { Route as EditorRoute } from '@/routes/(protected)/_protected.stock-management.physical-inventory_.$programId';

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/app-shell-skeleton', () => ({
  AppShellSkeleton: () => <p>Checking access</p>,
}));

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchFacility: vi.fn(),
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchValidReasons: vi.fn(),
}));

vi.mock('@/features/stock-events/api/physical-inventory-api', async (original) => ({
  ...(await original<typeof import('@/features/stock-events/api/physical-inventory-api')>()),
  fetchInventoryStockLines: vi.fn(),
  fetchEligibleInventoryProducts: vi.fn(),
  fetchPhysicalInventoryDraft: vi.fn(),
  startPhysicalInventory: vi.fn(),
}));

const USER = 'a337ec45-31a0-4f2b-9b2e-a105c4b669bb';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const EM = '10845cb9-d365-4aaa-badd-b4fa39c6a26a';
const PICKER = '/stock-management/physical-inventory';
const grants = [`STOCK_INVENTORIES_EDIT|${HOME}|${FP}`, `STOCK_INVENTORIES_EDIT|${HOME}|${EM}`];
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
  layout.update({
    beforeLoad: ProtectedRoute.options.beforeLoad,
    component: ProtectedRoute.options.component,
  } as never);
  const picker = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/physical-inventory',
    loader: PickerRoute.options.loader as never,
    component: PickerRoute.options.component as never,
    pendingComponent: PickerRoute.options.pendingComponent as never,
  });
  const editor = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/physical-inventory/$programId',
    validateSearch: EditorRoute.options.validateSearch as never,
    loader: EditorRoute.options.loader as never,
    component: EditorRoute.options.component as never,
    pendingComponent: EditorRoute.options.pendingComponent as never,
    staticData: EditorRoute.options.staticData,
  }).update({ id: '/stock-management/physical-inventory_/$programId' } as never);
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
  vi.mocked(fetchInventoryStockLines).mockResolvedValue([]);
  vi.mocked(fetchEligibleInventoryProducts).mockResolvedValue([]);
  vi.mocked(fetchPhysicalInventoryDraft).mockImplementation(async (scope) =>
    scope.programId === FP ? { id: 'draft', ...scope, lineItems: [] } : null,
  );
  vi.mocked(startPhysicalInventory).mockImplementation(async (scope) => ({
    id: 'new',
    ...scope,
    lineItems: [],
  }));
  vi.mocked(fetchValidReasons).mockResolvedValue([]);
  useLoginData.getState().setLoginData({
    referenceDataUserId: USER,
    username: 'administrator',
    accessToken: 'token',
  });
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

describe('physical inventory routes', () => {
  it('shows per-program status and starts a new draft before opening it', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute();
    const row = (await screen.findByText('Essential Meds')).closest('tr') as HTMLElement;
    await within(row).findByText('physical-inventory.not-started');
    expect(await screen.findByText('physical-inventory.draft')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'physical-inventory.start' }));
    await screen.findByRole('heading', { name: 'physical-inventory.editor-title' });
    expect(startPhysicalInventory).toHaveBeenCalledWith({ facilityId: HOME, programId: EM });
    expect(router.state.location.pathname).toBe(`${PICKER}/${EM}`);
  });
  it('continues an existing draft without posting', async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('button', { name: 'physical-inventory.continue' }));
    await screen.findByRole('heading', { name: 'physical-inventory.editor-title' });
    expect(startPhysicalInventory).not.toHaveBeenCalled();
  });
  it('recovers draft.exists by reading the draft another user started', async () => {
    const user = userEvent.setup();
    vi.mocked(startPhysicalInventory).mockRejectedValue(
      new AxiosError('Exists', undefined, undefined, undefined, {
        status: 400,
        data: { messageKey: 'stockmanagement.error.physicalInventory.draft.exists' },
      } as never),
    );
    renderRoute();
    await screen.findByText('physical-inventory.not-started');
    vi.mocked(fetchPhysicalInventoryDraft).mockImplementation(async (scope) => ({
      id: 'other-draft',
      ...scope,
      lineItems: [],
    }));
    await user.click(screen.getByRole('button', { name: 'physical-inventory.start' }));
    await screen.findByRole('heading', { name: 'physical-inventory.editor-title' });
    expect(fetchPhysicalInventoryDraft).toHaveBeenCalledWith({ programId: EM, facilityId: HOME });
  });
  it('refuses missing rights before lookups and hides navigation', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
    renderRoute();
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(fetchUserRecord).not.toHaveBeenCalled();
    expect(canOpen(PICKER, new Set(['STOCK_CARDS_VIEW']))).toBe(false);
    expect(canOpen(PICKER, new Set(['STOCK_INVENTORIES_EDIT']))).toBe(true);
  });
  it('refuses an unsupported program', async () => {
    vi.mocked(fetchFacility).mockResolvedValue({ ...homeFacility, supportedPrograms: [] });
    renderRoute(`${PICKER}/${FP}`);
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(fetchPhysicalInventoryDraft).not.toHaveBeenCalled();
  });
  it('explains a missing draft and does not load stock', async () => {
    renderRoute(`${PICKER}/${EM}`);
    expect(await screen.findByText('physical-inventory.no-draft-description')).toBeInTheDocument();
    expect(fetchInventoryStockLines).not.toHaveBeenCalled();
  });
  it('explains missing scoped stock view access without loading stock or eligibility', async () => {
    renderRoute(`${PICKER}/${FP}`);
    expect(
      await screen.findByText('physical-inventory.no-stock-view-description'),
    ).toBeInTheDocument();
    expect(fetchInventoryStockLines).not.toHaveBeenCalled();
    expect(fetchEligibleInventoryProducts).not.toHaveBeenCalled();
  });
  it('renders stock before eligibility resolves and preserves URL filters', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([
      ...grants,
      `STOCK_CARDS_VIEW|${HOME}|${FP}`,
    ]);
    vi.mocked(fetchEligibleInventoryProducts).mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchInventoryStockLines).mockResolvedValue([
      {
        orderable: { id: 'p', productCode: 'C1', fullProductName: 'Aspirin', description: null },
        lot: null,
        stockOnHand: 5,
        stockCardId: 'card',
        active: true,
      },
    ]);
    const { router } = renderRoute(`${PICKER}/${FP}?keyword=Aspirin&includeInactive=true&size=20`);
    expect(await screen.findByText('Aspirin')).toBeInTheDocument();
    expect(router.state.matches.at(-1)?.search).toMatchObject({
      keyword: 'Aspirin',
      includeInactive: true,
      size: undefined,
    });
    expect(
      screen.getByRole('columnheader', { name: 'physical-inventory.current-stock' }),
    ).toBeInTheDocument();
  });
});
