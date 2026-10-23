import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorFallback } from '@/components/error-fallback';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchApprovedProducts,
  fetchFacility,
  fetchFacilityOrderableFulfills,
  fetchLotsByTradeItems,
  fetchOrderablesByIds,
  fetchUserPrograms,
  fetchUserRecord,
  fetchValidAssignments,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import type { Facility } from '@/features/reference-data/lib/types';
import {
  fetchEventStockCards,
  fetchEventStockOnHand,
  submitStockEvent,
} from '@/features/stock-events/api/api';
import { waitForStockEventReceipt } from '@/features/stock-events/lib/stock-event-delivery';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { Route as ProtectedRoute } from '@/routes/(protected)/_protected';
import { Route as PickerRoute } from '@/routes/(protected)/_protected.stock-management.receive';
import { Route as EditorRoute } from '@/routes/(protected)/_protected.stock-management.receive_.$programId';

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/app-shell-skeleton', () => ({
  AppShellSkeleton: () => <p>Checking access</p>,
}));

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchReasons: vi.fn(),
  storedTimeZone: () => 'UTC',
  fetchDeploymentTimeZone: vi.fn(async () => 'UTC'),
  fetchFacility: vi.fn(),
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchValidReasons: vi.fn(),
  fetchValidAssignments: vi.fn(),
  fetchApprovedProducts: vi.fn(),
  fetchFacilityOrderableFulfills: vi.fn(),
  fetchOrderablesByIds: vi.fn(),
  fetchLotsByTradeItems: vi.fn(),
}));

vi.mock('@/features/stock-events/api/api', () => ({
  fetchEventStockCards: vi.fn(),
  fetchEventStockOnHand: vi.fn(),
  submitStockEvent: vi.fn(),
  fetchStockEventReport: vi.fn(),
}));

vi.mock('@/features/stock-events/lib/home-stock-bundle', async (original) => ({
  ...(await original<typeof import('@/features/stock-events/lib/home-stock-bundle')>()),
  getHomeStockBundle: async (filter: {
    facilityId: string;
    programId: string;
    facilityTypeId: string;
  }) => ({
    cards: await fetchEventStockCards({
      facilityId: filter.facilityId,
      programId: filter.programId,
    }),
    reasons: await fetchValidReasons({
      program: filter.programId,
      facilityType: filter.facilityTypeId,
    }),
    tradeItems: [],
  }),
}));
vi.mock('@/features/stock-events/lib/stock-event-delivery', async (original) => ({
  ...(await original<typeof import('@/features/stock-events/lib/stock-event-delivery')>()),
  waitForStockEventReceipt: vi.fn(),
}));

vi.mock('@/lib/open-report', () => ({
  openReport: vi.fn(() => ({ deliver: vi.fn(), close: vi.fn() })),
}));

const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: {} }, fr: { translation: {} } },
  keySeparator: false,
});

const USER = 'a337ec45-31a0-4f2b-9b2e-a105c4b669bb';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const EM = '10845cb9-d365-4aaa-badd-b4fa39c6a26a';
const PICKER = '/stock-management/receive';
const grants = [
  `STOCK_ADJUST|${HOME}|${FP}`,
  `STOCK_ADJUST|${HOME}|${EM}`,
  `STOCK_CARDS_VIEW|${HOME}|${FP}`,
];
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
    path: 'stock-management/receive',
    loader: PickerRoute.options.loader as never,
    component: PickerRoute.options.component as never,
    pendingComponent: PickerRoute.options.pendingComponent as never,
  });
  const editor = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/receive/$programId',
    validateSearch: EditorRoute.options.validateSearch as never,
    loader: EditorRoute.options.loader as never,
    component: EditorRoute.options.component as never,
    pendingComponent: EditorRoute.options.pendingComponent as never,
    staticData: EditorRoute.options.staticData,
  }).update({ id: '/stock-management/receive_/$programId' } as never);
  const stock = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/stock-on-hand',
    component: () => <h1>Stock landing</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([picker, editor, stock] as never)] as never),
    ] as never),
    context: { queryClient },
    defaultErrorComponent: ErrorFallback,
    history: createMemoryHistory({ initialEntries: [path] }),
  } as never) as AnyRouter;
  const view = render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return { router, queryClient, ...view };
}

beforeEach(async () => {
  vi.mocked(fetchEventStockCards).mockResolvedValue([]);
  vi.mocked(waitForStockEventReceipt).mockImplementation(async (event) => ({
    kind: 'accepted',
    receipt: {
      draftId: event.draftId,
      revision: event.revision,
      localEventId: event.localEventId,
      acceptedAt: Date.now(),
      source: 'server',
      serverEventId: 'event-id',
      event,
    },
  }));
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
  await i18n.changeLanguage('en');
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.mocked(fetchApprovedProducts).mockResolvedValue({
    content: [
      {
        id: 'approved',
        orderable: {
          id: 'product',
          productCode: 'C1',
          fullProductName: 'Aspirin',
          description: null,
          netContent: 16,
          identifiers: { tradeItem: 'trade' },
        },
      },
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 50,
  });
  vi.mocked(fetchFacilityOrderableFulfills).mockResolvedValue({});
  vi.mocked(fetchOrderablesByIds).mockResolvedValue([]);
  vi.mocked(fetchLotsByTradeItems).mockResolvedValue([]);
  vi.mocked(fetchEventStockOnHand).mockResolvedValue({});
  vi.mocked(submitStockEvent).mockResolvedValue('event-id');
  vi.mocked(fetchValidReasons).mockResolvedValue([]);
  vi.mocked(fetchValidAssignments).mockResolvedValue([
    {
      id: 'source',
      name: 'Ntcheu District Warehouse',
      programId: FP,
      facilityTypeId: 'type',
      node: { id: 'node', referenceId: 'org', refDataFacility: false },
      isFreeTextAllowed: true,
      geoLevelAffinityId: null,
    },
  ]);
  useLoginData.getState().setLoginData({
    referenceDataUserId: USER,
    username: 'administrator',
    accessToken: 'token',
  });
  await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).clear();
  await getLocalDb().table(LOCAL_TABLES.stockEventQueue).clear();
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

async function pickProduct(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'stock-events.product' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('combobox', { name: 'stock-events.product' }));
  await user.click(await screen.findByRole('option', { name: 'Aspirin' }));
}

async function submitLine(user: ReturnType<typeof userEvent.setup>) {
  await user.click(document.getElementById('lines[0].counterparty') as HTMLElement);
  await user.click(await screen.findByRole('option', { name: 'Ntcheu District Warehouse' }));
  fireEvent.change(document.querySelector('[name="lines[0].quantity.doses"]') as HTMLInputElement, {
    target: { value: '2' },
  });
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await user.click(await screen.findByRole('button', { name: 'stock-events.confirm' }));
}

describe('Receive new lots', () => {
  it('offers Add New Lot only with the lot management right', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchLotsByTradeItems).mockResolvedValue([
      { id: 'lot', lotCode: 'LOT-1', expirationDate: '2030-01-01', tradeItemId: 'trade' },
    ]);
    renderRoute(`${PICKER}/${FP}`);
    await pickProduct(user);
    await user.click(await screen.findByRole('combobox', { name: 'stock-events.lot-code' }));
    const options = await screen.findByRole('listbox');
    expect(within(options).getByRole('option', { name: /^LOT-1/ })).toBeInTheDocument();
    expect(within(options).queryByRole('option', { name: 'stock-events.add-new-lot' })).toBeNull();
  });

  it('submits a new lot through the device queue', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([...grants, 'LOTS_MANAGE']);
    const user = userEvent.setup();
    renderRoute(`${PICKER}/${FP}`);
    await pickProduct(user);
    await user.click(await screen.findByRole('combobox', { name: 'stock-events.lot-code' }));
    await user.click(await screen.findByRole('option', { name: 'stock-events.add-new-lot' }));
    await user.type(
      screen.getByRole('textbox', { name: 'stock-events.new-lot-code' }),
      'NEW-1{Enter}',
    );
    await submitLine(user);
    await screen.findByText('stock-receive.print-title');
    expect(vi.mocked(waitForStockEventReceipt).mock.calls[0][0].payload.lineItems[0]).toMatchObject(
      {
        lot: { lotCode: 'NEW-1' },
      },
    );
    expect(
      vi.mocked(waitForStockEventReceipt).mock.calls[0][0].payload.lineItems[0],
    ).not.toHaveProperty('lotId');
    expect(submitStockEvent).not.toHaveBeenCalled();
  });
});
