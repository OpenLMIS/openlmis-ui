import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import {
  act,
  cleanup,
  type RenderOptions,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { createContext } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchFacility,
  fetchUserPrograms,
  fetchUserRecord,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import type { Facility } from '@/features/reference-data/lib/types';
import {
  createPhysicalInventoryLot,
  fetchEligibleInventoryProducts,
  fetchInventoryStockLines,
  fetchInventorySummaries,
  fetchPhysicalInventoryDraft,
  savePhysicalInventory,
  startPhysicalInventory,
} from '@/features/stock-events/api/physical-inventory-api';
import {
  inventoryStockLinesOptions,
  physicalInventoryDraftOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import {
  buildInventoryLines,
  inventoryLocalCopy,
} from '@/features/stock-events/lib/physical-inventory-lines';
import { inventoryReference } from '@/features/stock-events/lib/physical-inventory-local';
import type { InventoryStockLine } from '@/features/stock-events/lib/physical-inventory-types';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { Route as ProtectedRoute } from '@/routes/(protected)/_protected';
import { Route as PickerRoute } from '@/routes/(protected)/_protected.stock-management.physical-inventory';
import { Route as EditorRoute } from '@/routes/(protected)/_protected.stock-management.physical-inventory_.$programId';
import { expectRouteWarning } from '@/test-utils/expect-route-warning';
import { offlineAccessFixture } from '@/test-utils/offline-access';

vi.mock('@/features/system-notifications/api/api', () => ({
  fetchSystemNotifications: async () => [],
}));
vi.mock('@/components/app-shell/app-shell', () => ({
  AppShellContext: createContext(false),
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/app-shell/app-shell-skeleton', () => ({
  AppShellSkeleton: () => <p>Checking access</p>,
}));

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  storedTimeZone: vi.fn().mockReturnValue('UTC'),
  fetchCurrencySettings: vi.fn(async () => ({ timeZoneId: 'UTC' })),
  fetchFacility: vi.fn(),
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchValidReasons: vi.fn(),
}));

vi.mock('@/features/stock-events/api/physical-inventory-api', async (original) => ({
  ...(await original<typeof import('@/features/stock-events/api/physical-inventory-api')>()),
  createPhysicalInventoryLot: vi.fn(),
  fetchInventoryStockLines: vi.fn(),
  fetchInventorySummaries: vi.fn().mockResolvedValue([]),
  fetchEligibleInventoryProducts: vi.fn(),
  fetchPhysicalInventoryDraft: vi.fn(),
  savePhysicalInventory: vi.fn(),
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

function loadEditor(queryClient: QueryClient, cause: 'enter' | 'stay' = 'enter') {
  const loader = EditorRoute.options.loader;
  if (!loader || typeof loader === 'function')
    throw new Error('Expected object-form editor loader');
  return loader.handler({
    route: EditorRoute,
    context: { queryClient },
    params: { programId: FP },
    cause,
  } as Parameters<typeof loader.handler>[0]);
}

function renderRoute(
  path = PICKER,
  seed?: (client: QueryClient) => void,
  {
    onPickerRender,
    ...renderOptions
  }: Pick<RenderOptions, 'onCaughtError'> & {
    onPickerRender?: () => void;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false, networkMode: 'always' },
      mutations: { networkMode: 'always' },
    },
  });
  seed?.(queryClient);
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  layout.update({
    beforeLoad: ProtectedRoute.options.beforeLoad,
    component: ProtectedRoute.options.component,
  } as never);
  const PickerPage = PickerRoute.options.component;
  const picker = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/physical-inventory',
    loader: PickerRoute.options.loader as never,
    staticData: PickerRoute.options.staticData,
    component: () => {
      onPickerRender?.();
      return PickerPage ? <PickerPage /> : null;
    },
    pendingComponent: PickerRoute.options.pendingComponent as never,
  });
  const editor = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/physical-inventory/$programId',
    validateSearch: EditorRoute.options.validateSearch as never,
    loader: EditorRoute.options.loader as never,
    shouldReload: EditorRoute.options.shouldReload as never,
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
    renderOptions,
  );
  return { router, queryClient, ...view };
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
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

afterEach(() => {
  cleanup();
  useLoginData.setState({ referenceDataUserId: null });
});

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
  it('keeps the picker unmounted while rights are pending and after denial', async () => {
    const assertRouteWarning = expectRouteWarning(
      `/(protected)/_protected/stock-management/physical-inventory${PICKER}`,
    );
    const onCaughtError = vi.fn((caught: unknown) => {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect(caught).toHaveProperty('message', 'Missing right STOCK_INVENTORIES_EDIT');
    });
    const permissions = Promise.withResolvers<string[]>();
    vi.mocked(fetchPermissionStrings).mockReturnValue(permissions.promise);
    const onPickerRender = vi.fn();
    renderRoute(PICKER, undefined, { onCaughtError, onPickerRender });
    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalledWith(USER));
    expect(onPickerRender).not.toHaveBeenCalled();
    expect(fetchInventorySummaries).not.toHaveBeenCalled();
    permissions.resolve([]);
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(onPickerRender).not.toHaveBeenCalled();
    expect(
      vi
        .mocked(fetchUserRecord)
        .mock.calls.every(([, config]) => config?.connectionStatus === false),
    ).toBe(true);
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
  });
  it('shows No Home Facility and links back to the program list', async () => {
    const assertRouteWarning = expectRouteWarning(
      `/(protected)/_protected/stock-management/physical-inventory_/$programId${PICKER}/${FP}`,
    );
    vi.mocked(fetchUserRecord).mockResolvedValue({
      id: USER,
      username: 'administrator',
      firstName: 'Admin',
      lastName: 'Istrator',
      active: true,
      homeFacilityId: null,
      roleAssignments: [],
    });
    renderRoute(`${PICKER}/${FP}`, undefined, { onCaughtError: vi.fn() });
    expect(
      await screen.findByRole('heading', { name: 'stock-programs.no-home-title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('facility-program.no-home')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'stock-programs.back' })).toHaveAttribute(
      'href',
      '/stock-management/physical-inventory',
    );
    expect(fetchFacility).not.toHaveBeenCalled();
    expect(fetchPhysicalInventoryDraft).not.toHaveBeenCalled();
    assertRouteWarning();
  });
  it('refuses an unsupported program', async () => {
    const assertRouteWarning = expectRouteWarning(
      `/(protected)/_protected/stock-management/physical-inventory_/$programId${PICKER}/${FP}`,
    );
    const onCaughtError = vi.fn((caught: unknown) => {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect(caught).toHaveProperty('message', 'Missing right STOCK_INVENTORIES_EDIT');
    });
    vi.mocked(fetchFacility).mockResolvedValue({ ...homeFacility, supportedPrograms: [] });
    renderRoute(`${PICKER}/${FP}`, undefined, { onCaughtError });
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(fetchPhysicalInventoryDraft).not.toHaveBeenCalled();
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
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

it('reads fresh stock on every entry and keeps the cached stock on stay', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    ...grants,
    `STOCK_CARDS_VIEW|${HOME}|${FP}`,
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const draft = { id: 'draft', programId: FP, facilityId: HOME, lineItems: [] };
  const stock = {
    orderable: { id: 'p', productCode: 'P', fullProductName: 'Product', description: null },
    lot: null,
    stockOnHand: 42,
    stockCardId: 'c',
    active: true,
  };
  queryClient.setQueryData(inventoryStockLinesOptions(draft).queryKey, [
    { ...stock, stockOnHand: 5 },
  ]);
  vi.mocked(fetchInventoryStockLines).mockResolvedValue([stock]);
  await loadEditor(queryClient);
  await waitFor(() =>
    expect(queryClient.getQueryData(inventoryStockLinesOptions(draft).queryKey)).toEqual([stock]),
  );
  const lines = queryClient.getQueryData(inventoryStockLinesOptions(draft).queryKey);
  expect(buildInventoryLines(lines ?? [], [])[0].stockOnHand).toBe(42);
  await loadEditor(queryClient, 'stay');
  expect(fetchInventoryStockLines).toHaveBeenCalledTimes(1);
  await loadEditor(queryClient);
  await waitFor(() => expect(fetchInventoryStockLines).toHaveBeenCalledTimes(2));
  expect(fetchInventorySummaries).toHaveBeenCalledTimes(2);
});
it('starts the user read alongside permissions and prefetches lookups before a blocking draft completes', async () => {
  const permissions = Promise.withResolvers<string[]>();
  const draft = Promise.withResolvers<null>();
  vi.mocked(fetchPermissionStrings).mockReturnValueOnce(permissions.promise);
  vi.mocked(fetchPhysicalInventoryDraft).mockReturnValueOnce(draft.promise);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const loading = loadEditor(queryClient);
  await waitFor(() => expect(fetchUserRecord).toHaveBeenCalled());
  permissions.resolve([...grants, `STOCK_CARDS_VIEW|${HOME}|${FP}`]);
  await waitFor(() => expect(fetchEligibleInventoryProducts).toHaveBeenCalled());
  expect(fetchValidReasons).toHaveBeenCalled();
  draft.resolve(null);
  await loading;
});

it('blocks a cached draft on re-entry after Start until the new draft is hydrated', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    ...grants,
    `STOCK_CARDS_VIEW|${HOME}|${FP}`,
  ]);
  const stock = [
    {
      orderable: { id: 'p', productCode: 'P', fullProductName: 'Product', description: null },
      lot: null,
      stockOnHand: 5,
      stockCardId: 'card',
      active: true,
    },
  ];
  vi.mocked(fetchInventoryStockLines).mockResolvedValue(stock);
  vi.mocked(fetchEligibleInventoryProducts).mockResolvedValue(stock);
  vi.mocked(fetchPhysicalInventoryDraft).mockResolvedValue({
    id: 'deleted-draft',
    programId: FP,
    facilityId: HOME,
    lineItems: [{ orderableId: 'p', lotId: null, quantity: 99 }],
  });
  const user = userEvent.setup();
  const { router, queryClient } = renderRoute(`${PICKER}/${FP}`);
  await screen.findByDisplayValue('99');
  await act(() => router.navigate({ to: PICKER }));
  const row = (await screen.findByText('Family Planning')).closest('tr') as HTMLElement;
  await act(async () => {
    queryClient.setQueryData(
      physicalInventoryDraftOptions({ programId: FP, facilityId: HOME }).queryKey,
      null,
    );
  });
  const fresh = Promise.withResolvers<{
    id: string;
    programId: string;
    facilityId: string;
    lineItems: [];
  }>();
  vi.mocked(fetchPhysicalInventoryDraft).mockImplementation((scope) =>
    scope.programId === FP ? fresh.promise : Promise.resolve(null),
  );
  await user.click(await within(row).findByRole('button', { name: 'physical-inventory.start' }));
  await waitFor(() => expect(router.state.matches.at(-1)?.status).toBe('pending'));
  expect(screen.queryByDisplayValue('99')).not.toBeInTheDocument();
  await act(async () => {
    fresh.resolve({ id: 'new', programId: FP, facilityId: HOME, lineItems: [] });
  });
  const next = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  expect(next).toHaveValue('');
  await user.type(next, '7');
  await waitFor(() => expect(next).toHaveValue('7'));
});

it('starts eligible expansion while stock-line hydration is still pending', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    ...grants,
    `STOCK_CARDS_VIEW|${HOME}|${FP}`,
  ]);
  const stock = Promise.withResolvers<[]>();
  vi.mocked(fetchInventoryStockLines).mockReturnValueOnce(stock.promise);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const loading = loadEditor(queryClient);
  await waitFor(() => expect(fetchInventoryStockLines).toHaveBeenCalled());
  expect(fetchEligibleInventoryProducts).toHaveBeenCalled();
  stock.resolve([]);
  await loading;
});

it.each([1, 2])('focuses the first invalid count after Close from page %s', async (page) => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    ...grants,
    `STOCK_CARDS_VIEW|${HOME}|${FP}`,
  ]);
  const stock = ['A', 'B'].map((id) => ({
    orderable: { id, productCode: id, fullProductName: id, description: null },
    lot: null,
    stockOnHand: 5,
    stockCardId: id,
    active: true,
  }));
  vi.mocked(fetchInventoryStockLines).mockResolvedValue(stock);
  vi.mocked(fetchEligibleInventoryProducts).mockResolvedValue(stock);
  const user = userEvent.setup();
  const { router } = renderRoute(
    page === 1 ? `${PICKER}/${FP}` : `${PICKER}/${FP}?size=1&page=${page}`,
  );
  const input = (await screen.findAllByRole('textbox', { name: 'stock-events.field-of' }))[0];
  if (page === 1) await user.type(input, '7');
  await user.click(await screen.findByRole('button', { name: 'stock-events.submit' }));
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  await waitFor(() =>
    expect(router.state.matches.at(-1)?.search).toMatchObject({ page: undefined }),
  );
  if (page === 1) {
    expect(input).toBeInTheDocument();
    expect(fetchInventoryStockLines).toHaveBeenCalledTimes(1);
  }
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getAllByRole('textbox', { name: 'stock-events.field-of' })[0],
    ),
  );
});

it('renders the editor header during stock loading and retries a summaries failure in place', async () => {
  const failure = new AxiosError('Failed', undefined, undefined, undefined, {
    status: 500,
  } as never);
  const onCaughtError = vi.fn((caught: unknown) => expect(caught).toBe(failure));
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    ...grants,
    `STOCK_CARDS_VIEW|${HOME}|${FP}`,
  ]);
  const summaries = Promise.withResolvers<[]>();
  vi.mocked(fetchInventorySummaries).mockReturnValue(summaries.promise);
  renderRoute(`${PICKER}/${FP}`, undefined, { onCaughtError });
  await screen.findByRole('heading', { name: 'physical-inventory.editor-title' });
  expect(screen.queryByRole('textbox', { name: 'stock-events.field-of' })).not.toBeInTheDocument();
  summaries.reject(failure);
  await screen.findByText('physical-inventory.load-error-description');
  expect(
    screen.getByRole('heading', { name: 'physical-inventory.editor-title' }),
  ).toBeInTheDocument();
  vi.mocked(fetchInventorySummaries).mockResolvedValue([]);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Try Again' }));
  await screen.findByText('physical-inventory.empty-description');
  expect(onCaughtError).toHaveBeenCalled();
});

it('keeps cached stock out of the form until fresh entry stock resolves', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    ...grants,
    `STOCK_CARDS_VIEW|${HOME}|${FP}`,
  ]);
  const draft = { id: 'draft', programId: FP, facilityId: HOME, lineItems: [] };
  const old = {
    orderable: { id: 'p', productCode: 'P', fullProductName: 'Old Product', description: null },
    lot: null,
    stockOnHand: 5,
    stockCardId: 'c',
    active: true,
  };
  const fresh = Promise.withResolvers<(typeof old)[]>();
  vi.mocked(fetchInventoryStockLines).mockReturnValue(fresh.promise);
  vi.mocked(fetchEligibleInventoryProducts).mockReturnValue(fresh.promise);
  renderRoute(`${PICKER}/${FP}`, (client) => {
    client.setQueryData(inventoryStockLinesOptions(draft).queryKey, [old], {
      updatedAt: Date.now() - 1000,
    });
  });
  await screen.findByRole('heading', { name: 'physical-inventory.editor-title' });
  expect(screen.queryByText('Old Product')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'stock-events.field-of' })).not.toBeInTheDocument();
  fresh.resolve([{ ...old, orderable: { ...old.orderable, fullProductName: 'Fresh Product' } }]);
  await screen.findByText('Fresh Product');
});

it('does not start deferred eligibility for another user after summaries resolve', async () => {
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    ...grants,
    `STOCK_CARDS_VIEW|${HOME}|${FP}`,
  ]);
  const summaries = Promise.withResolvers<[]>();
  vi.mocked(fetchInventorySummaries).mockReturnValue(summaries.promise);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await loadEditor(queryClient);
  useLoginData.setState({ referenceDataUserId: 'another-user' });
  summaries.resolve([]);
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(fetchEligibleInventoryProducts).not.toHaveBeenCalled();
});

it('lists granted home programs offline with a reason for missing copies and never offers Start', async () => {
  const extra = { id: 'without-copy', code: 'NC', name: 'No Copy', active: true };
  const allPrograms = [...programs, extra];
  const access = offlineAccessFixture({
    userId: USER,
    home: {
      ...homeFacility,
      supportedPrograms: allPrograms.map((program) => ({
        ...program,
        supportActive: true,
        supportLocallyFulfilled: false,
      })),
    },
    programs: allPrograms,
    rights: [
      grants[0],
      `STOCK_INVENTORIES_EDIT|${HOME}|${extra.id}`,
      `STOCK_INVENTORIES_EDIT|other|${EM}`,
    ],
  });
  await getLocalDb().table(LOCAL_TABLES.offlineAccess).put(access);
  await getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts).clear();
  for (const program of programs) {
    await getLocalDb()
      .table(LOCAL_TABLES.physicalInventoryDrafts)
      .put(
        inventoryLocalCopy(
          { id: program.id, facilityId: HOME, programId: program.id },
          [],
          [],
          false,
          { fetchedAt: 123, generation: 'device' },
        ),
      );
  }
  onlineManager.setOnline(false);
  renderRoute();
  await screen.findAllByText('physical-inventory.not-on-device');
  const actions = screen.getAllByRole('button', { name: 'physical-inventory.continue' });
  expect(actions[0]).toBeEnabled();
  expect(actions[1]).toBeDisabled();
  expect(screen.getByText('Family Planning')).toBeInTheDocument();
  expect(screen.queryByText('Essential Meds')).not.toBeInTheDocument();
  expect(screen.getByText('No Copy')).toBeInTheDocument();
  expect(screen.getByText('physical-inventory.open-online-first')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'physical-inventory.start' }),
  ).not.toBeInTheDocument();
  expect(fetchPermissionStrings).not.toHaveBeenCalled();
  expect(fetchPhysicalInventoryDraft).not.toHaveBeenCalled();
  expect(startPhysicalInventory).not.toHaveBeenCalled();
});

async function seedDeviceEditor(formatVersion = 1) {
  const access = offlineAccessFixture({
    userId: USER,
    home: homeFacility,
    programs,
    rights: [...grants, `STOCK_CARDS_VIEW|${HOME}|${FP}`, 'LOTS_MANAGE'],
  });
  await getLocalDb().table(LOCAL_TABLES.offlineAccess).put(access);
  await getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts).clear();
  const stock = [
    {
      orderable: {
        id: 'p',
        productCode: 'P',
        fullProductName: 'Stored Product',
        description: null,
        identifiers: { tradeItem: 'trade' },
      },
      lot: null,
      stockOnHand: 5,
      stockCardId: 'card',
      active: true,
    },
  ];
  const lines = buildInventoryLines(stock, [{ orderableId: 'p', quantity: 7 }]);
  const snapshot = { fetchedAt: 123, generation: 'device' };
  const copy = {
    ...inventoryLocalCopy(
      { id: 'device', facilityId: HOME, programId: FP },
      lines,
      lines,
      false,
      snapshot,
    ),
    ...snapshot,
    formatVersion,
  };
  await getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts).put(copy);
  await getLocalDb()
    .table(LOCAL_TABLES.physicalInventoryReference)
    .put(inventoryReference(copy, stock, []));
  return copy;
}
it('opens unmodified device lines offline and keeps their counts and source on reconnect', async () => {
  await seedDeviceEditor();
  onlineManager.setOnline(false);
  const { router } = renderRoute(`${PICKER}/${FP}`, (client) =>
    client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true }),
  );
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  expect(input).toHaveValue('7');
  expect(router.state.matches.at(-1)?.loaderData).toMatchObject({
    draft: { lineItems: [expect.objectContaining({ orderableId: 'p', quantity: 7 })] },
  });
  expect(screen.getByText('physical-inventory.offline-snapshot')).toBeInTheDocument();
  act(() => onlineManager.setOnline(true));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'physical-inventory.save' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    ),
  );
  expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toBe(input);
  expect(input).toHaveValue('7');
  expect(screen.getByText('physical-inventory.reconnected-snapshot')).toBeInTheDocument();
  expect(fetchPhysicalInventoryDraft).not.toHaveBeenCalled();
  expect(fetchInventoryStockLines).not.toHaveBeenCalled();
  expect(fetchEligibleInventoryProducts).not.toHaveBeenCalled();
  expect(fetchValidReasons).not.toHaveBeenCalled();
});

it.each(['succeeds', 'times out'])(
  'keeps page-only counts after a duplicate lot in an offline-opened draft when the picker refresh %s',
  async (outcome) => {
    const copy = await seedDeviceEditor();
    const local = await import('@/features/stock-events/lib/physical-inventory-local');
    const reference = await local.requireInventoryReference(copy);
    vi.spyOn(local, 'writeInventoryLocal').mockRejectedValue(new Error('Device write failed'));
    vi.mocked(fetchPhysicalInventoryDraft).mockResolvedValue({
      id: copy.draftId,
      facilityId: HOME,
      programId: FP,
      lineItems: [],
    });
    vi.mocked(createPhysicalInventoryLot).mockRejectedValueOnce(
      new AxiosError('Duplicate lot', undefined, undefined, undefined, {
        status: 400,
        data: { messageKey: 'referenceData.error.lot.lotCode.mustBeUnique' },
      } as never),
    );
    const refresh = Promise.withResolvers<InventoryStockLine[]>();
    vi.mocked(fetchEligibleInventoryProducts)
      .mockReset()
      .mockResolvedValueOnce(reference.eligible)
      .mockReturnValueOnce(refresh.promise);
    onlineManager.setOnline(false);
    const user = userEvent.setup();
    renderRoute(`${PICKER}/${FP}`, (client) =>
      client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true }),
    );
    const count = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
    await user.clear(count);
    await user.type(count, '12');
    expect(fetchEligibleInventoryProducts).not.toHaveBeenCalled();
    act(() => onlineManager.setOnline(true));

    const openAddProducts = async () => {
      await user.click(screen.getByRole('button', { name: 'physical-inventory.add-product' }));
      return screen.findByRole('dialog', { name: 'physical-inventory.add-products-title' });
    };
    const add = await openAddProducts();
    await user.type(
      within(add).getByRole('textbox', { name: 'physical-inventory.new-lot-code' }),
      'New Batch',
    );
    await user.click(within(add).getByRole('button', { name: 'stock-events.add' }));
    await user.type(within(add).getByRole('textbox', { name: 'stock-events.field-of' }), '3');
    await user.click(within(add).getByRole('button', { name: 'physical-inventory.add-items' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const save = screen.getByRole('button', { name: 'physical-inventory.save' });
    const submit = screen.getByRole('button', { name: 'stock-events.submit' });
    await user.click(save);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
    );
    const alert = await screen.findByRole('alertdialog');
    expect(alert).toHaveTextContent('physical-inventory.lot-duplicate-error');
    await user.click(within(alert).getByRole('button', { name: 'dialog.close' }));

    await waitFor(() => expect(fetchEligibleInventoryProducts).toHaveBeenCalledTimes(2));
    expect(save).toBeEnabled();
    expect(submit).toBeEnabled();
    await act(async () => {
      if (outcome === 'succeeds') {
        refresh.resolve([
          ...reference.eligible,
          {
            ...reference.eligible[0],
            lot: { id: 'lot', lotCode: 'New Batch', expirationDate: null, tradeItemId: 'trade' },
          },
        ]);
      } else refresh.reject(new AxiosError('Picker timed out', AxiosError.ECONNABORTED));
    });

    expect(screen.getAllByRole('textbox', { name: 'stock-events.field-of' })[0]).toBe(count);
    expect(count).toHaveValue('12');
    expect(screen.getAllByRole('textbox', { name: 'stock-events.field-of' })[1]).toHaveValue('3');
    expect(save).toBeEnabled();
    expect(submit).toBeEnabled();
    expect(savePhysicalInventory).not.toHaveBeenCalled();
    expect(await local.readInventoryLocal(copy.draftId)).toEqual(copy);
    expect(await local.requireInventoryReference(copy)).toEqual(reference);

    const picker = await openAddProducts();
    await user.click(within(picker).getByRole('combobox', { name: 'stock-events.lot-code' }));
    expect(
      screen.getByRole('option', { name: 'physical-inventory.add-new-lot' }),
    ).toBeInTheDocument();
    if (outcome === 'succeeds')
      expect(screen.getByRole('option', { name: 'New Batch' })).toBeInTheDocument();
    else expect(screen.queryByRole('option', { name: 'New Batch' })).not.toBeInTheDocument();
  },
);

it.each(['absent', 'older format'])(
  'explains an %s copy inside the editor and reloads it on reconnect',
  async (kind) => {
    await seedDeviceEditor(0);
    if (kind === 'absent') await getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts).clear();
    onlineManager.setOnline(false);
    renderRoute(`${PICKER}/${FP}`);
    await screen.findByText('physical-inventory.not-on-device');
    expect(screen.getByText('physical-inventory.editor-title')).toBeInTheDocument();
    expect(screen.getByText('stock-programs.back').closest('a')).toHaveAttribute(
      'href',
      expect.stringContaining('/stock-management/physical-inventory'),
    );
    expect(fetchPhysicalInventoryDraft).not.toHaveBeenCalled();
    expect(fetchInventoryStockLines).not.toHaveBeenCalled();
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(fetchPhysicalInventoryDraft).toHaveBeenCalled());
  },
);

it('uses stored counts when the draft GET loses connection after the online check', async () => {
  const copy = await seedDeviceEditor();
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    ...grants,
    `STOCK_CARDS_VIEW|${HOME}|${FP}`,
  ]);
  vi.mocked(fetchPhysicalInventoryDraft).mockRejectedValueOnce(new AxiosError('Network Error'));
  const { router } = renderRoute(`${PICKER}/${FP}`, (client) =>
    client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true }),
  );
  expect(await screen.findByRole('textbox', { name: 'stock-events.field-of' })).toHaveValue('7');
  expect(router.state.matches.at(-1)?.loaderData).toMatchObject({ deviceCopy: copy });
  expect(fetchPhysicalInventoryDraft).toHaveBeenCalled();
  expect(fetchInventoryStockLines).not.toHaveBeenCalled();
});

it('shows failed offline program reads and retries every failed program', async () => {
  const local = await import('@/features/stock-events/lib/physical-inventory-local');
  await seedDeviceEditor();
  const read = vi
    .spyOn(local, 'readInventoryLocalByScope')
    .mockRejectedValue(new Error('Device read failed'));
  onlineManager.setOnline(false);
  const user = userEvent.setup();
  renderRoute();
  await screen.findByText('physical-inventory.list-load-error-description');
  expect(screen.getAllByText('physical-inventory.status-error')).toHaveLength(2);
  read.mockClear();
  await user.click(screen.getByRole('button', { name: 'Try Again' }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  read.mockRestore();
});

it('waits for device reasons without asking for a connection', async () => {
  const copy = await seedDeviceEditor();
  const local = await import('@/features/stock-events/lib/physical-inventory-local');
  const reference = await local.requireInventoryReference(copy);
  const pending = Promise.withResolvers<typeof reference>();
  const read = vi.spyOn(local, 'requireInventoryReference').mockReturnValue(pending.promise);
  onlineManager.setOnline(false);
  const user = userEvent.setup();
  renderRoute(`${PICKER}/${FP}`, (client) =>
    client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true }),
  );
  await user.click(await screen.findByRole('button', { name: /physical-inventory.add-reasons/ }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).not.toHaveTextContent('offline.unavailable-description');
  expect(dialog.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  await act(async () => pending.resolve(reference));
  await waitFor(() =>
    expect(dialog.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument(),
  );
  read.mockRestore();
});

it('preserves the open online editor when offline validation changes search', async () => {
  await seedDeviceEditor();
  vi.mocked(fetchPermissionStrings).mockResolvedValue([
    ...grants,
    `STOCK_CARDS_VIEW|${HOME}|${FP}`,
  ]);
  const stock = ['A', 'B'].map((id) => ({
    orderable: { id, productCode: id, fullProductName: id, description: null },
    lot: null,
    stockOnHand: 5,
    stockCardId: id,
    active: true,
  }));
  vi.mocked(fetchInventoryStockLines).mockResolvedValue(stock);
  vi.mocked(fetchEligibleInventoryProducts).mockResolvedValue(stock);
  vi.mocked(fetchPhysicalInventoryDraft).mockResolvedValue({
    id: 'draft',
    facilityId: HOME,
    programId: FP,
    lineItems: [{ orderableId: 'A', quantity: 20 }],
  });
  const user = userEvent.setup();
  const { router } = renderRoute(`${PICKER}/${FP}`);
  const input = (await screen.findAllByRole('textbox', { name: 'stock-events.field-of' }))[0];
  expect(input).toHaveValue('20');
  await user.clear(input);
  await user.type(input, '12');
  const opened = router.state.matches.at(-1)?.loaderData;
  act(() => onlineManager.setOnline(false));
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
  );
  await waitFor(() => expect(router.state.status).toBe('idle'));
  expect(router.state.matches.at(-1)?.loaderData).toBe(opened);
  expect(input).toHaveValue('12');
  expect(input).toBeInTheDocument();
  expect(fetchInventoryStockLines).toHaveBeenCalledTimes(1);
});

it('refuses Start if connectivity changes before its click is handled', async () => {
  const error = vi.spyOn(toast, 'error');
  renderRoute();
  const start = await screen.findByRole('button', { name: 'physical-inventory.start' });
  act(() => {
    onlineManager.setOnline(false);
    start.click();
  });
  await waitFor(() =>
    expect(error).toHaveBeenCalledWith('physical-inventory.start-error-title', {
      description: 'offline.action-description',
    }),
  );
  expect(startPhysicalInventory).not.toHaveBeenCalled();
});
