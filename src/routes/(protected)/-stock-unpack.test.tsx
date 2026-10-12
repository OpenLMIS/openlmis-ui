import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorFallback } from '@/components/error-fallback';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchFacility,
  fetchOrderablesByIds,
  fetchReasons,
  fetchUserPrograms,
  fetchUserRecord,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import type { Facility } from '@/features/reference-data/lib/types';
import { fetchEventStockCards, submitStockEvent } from '@/features/stock-events/api/api';
import { Route as ProtectedRoute } from '@/routes/(protected)/_protected';
import { Route as PickerRoute } from '@/routes/(protected)/_protected.stock-management.unpack';
import { Route as EditorRoute } from '@/routes/(protected)/_protected.stock-management.unpack_.$programId';

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/app-shell-skeleton', () => ({
  AppShellSkeleton: () => <p>Checking access</p>,
}));

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchOrderablesByIds: vi.fn(),
  fetchReasons: vi.fn(),
  fetchFacility: vi.fn(),
  fetchUserRecord: vi.fn(),
  fetchUserPrograms: vi.fn(),
  fetchValidReasons: vi.fn(),
}));

vi.mock('@/features/stock-events/api/api', () => ({
  fetchEventStockCards: vi.fn(),
  submitStockEvent: vi.fn(),
}));

vi.mock('@/lib/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/runtime-config')>()),
  getKitUnpackReasonIds: vi.fn(() => ({
    kitUnpackReasonId: 'unpack',
    unpackedFromKitReasonId: 'contents',
  })),
}));

const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  keySeparator: false,
});

const USER = 'a337ec45-31a0-4f2b-9b2e-a105c4b669bb';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const PICKER = '/stock-management/unpack';
const grants = [`STOCK_ADJUST|${HOME}|${FP}`];
const programs = [{ id: FP, code: 'PRG001', name: 'Family Planning', active: true }];
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
    path: 'stock-management/unpack',
    loader: PickerRoute.options.loader as never,
    component: PickerRoute.options.component as never,
    pendingComponent: PickerRoute.options.pendingComponent as never,
  });
  const editor = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/unpack/$programId',
    validateSearch: EditorRoute.options.validateSearch as never,
    loader: EditorRoute.options.loader as never,
    component: EditorRoute.options.component as never,
    pendingComponent: EditorRoute.options.pendingComponent as never,
    staticData: EditorRoute.options.staticData,
  }).update({ id: '/stock-management/unpack_/$programId' } as never);
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
  await i18n.changeLanguage('en');
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.mocked(fetchEventStockCards).mockResolvedValue([]);
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

describe('Unpack after submit', () => {
  it('lands on Stock On Hand for the home facility and program without printing', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([
      ...grants,
      `STOCK_CARDS_VIEW|${HOME}|${FP}`,
    ]);
    const kit = {
      id: 'kit',
      description: null,
      productCode: 'K1',
      fullProductName: 'Delivery Kit',
      netContent: 1,
      children: [{ orderable: { id: 'gloves' }, quantity: 2 }],
    };
    vi.mocked(fetchEventStockCards).mockResolvedValue([
      { stockOnHand: 50, orderable: kit, lot: null },
    ]);
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([kit]);
    vi.mocked(fetchReasons).mockResolvedValue([
      {
        id: 'unpack',
        name: 'Unpack Kit',
        reasonType: 'DEBIT',
        reasonCategory: 'AGGREGATION',
        isFreeTextAllowed: false,
        tags: [],
      },
      {
        id: 'contents',
        name: 'Unpacked From Kit',
        reasonType: 'CREDIT',
        reasonCategory: 'AGGREGATION',
        isFreeTextAllowed: false,
        tags: [],
      },
    ]);
    vi.mocked(submitStockEvent).mockResolvedValue('event-id');
    const user = userEvent.setup();
    const { router, queryClient, unmount } = renderRoute(`${PICKER}/${FP}`);
    try {
      const add = await screen.findByRole('button', { name: 'stock-events.add' });
      await waitFor(() => expect(add).toBeEnabled());
      await user.click(add);
      fireEvent.change(
        document.querySelector('[name="lines[0].quantity.doses"]') as HTMLInputElement,
        { target: { value: '2' } },
      );
      await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
      await user.click(await screen.findByRole('button', { name: 'stock-events.confirm' }));
      expect(await screen.findByRole('heading', { name: 'Stock landing' })).toBeInTheDocument();
      expect(router.state.location.search).toMatchObject({
        mode: 'my',
        facilityId: HOME,
        programId: FP,
      });
      expect(submitStockEvent).toHaveBeenCalledOnce();
    } finally {
      unmount();
      await queryClient.cancelQueries();
      queryClient.clear();
    }
  });
});
