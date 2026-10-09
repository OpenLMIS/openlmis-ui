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
  fetchUserPrograms,
  fetchUserRecord,
  fetchValidAssignments,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import type { Facility } from '@/features/reference-data/lib/types';
import {
  fetchEventStockCards,
  fetchStockEventReport,
  submitStockEvent,
} from '@/features/stock-events/api/api';
import { Route as ProtectedRoute } from '@/routes/(protected)/_protected';
import { Route as PickerRoute } from '@/routes/(protected)/_protected.stock-management.issue';
import { Route as EditorRoute } from '@/routes/(protected)/_protected.stock-management.issue_.$programId';

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
  fetchValidAssignments: vi.fn(),
}));

vi.mock('@/features/stock-events/api/api', () => ({
  fetchEventStockCards: vi.fn(),
  submitStockEvent: vi.fn(),
  fetchStockEventReport: vi.fn(),
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
const PICKER = '/stock-management/issue';
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
  layout.update({
    beforeLoad: ProtectedRoute.options.beforeLoad,
    component: ProtectedRoute.options.component,
  } as never);
  const picker = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/issue',
    loader: PickerRoute.options.loader as never,
    component: PickerRoute.options.component as never,
    pendingComponent: PickerRoute.options.pendingComponent as never,
  });
  const editor = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/issue/$programId',
    validateSearch: EditorRoute.options.validateSearch as never,
    loader: EditorRoute.options.loader as never,
    component: EditorRoute.options.component as never,
    pendingComponent: EditorRoute.options.pendingComponent as never,
    staticData: EditorRoute.options.staticData,
  }).update({ id: '/stock-management/issue_/$programId' } as never);
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
  vi.mocked(fetchValidAssignments).mockResolvedValue([
    {
      id: 'destination',
      name: 'CHW',
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

describe('Issue report after submit', () => {
  it.each([
    ['stock-issue.print-skip', 'en'],
    ['stock-event.print', 'en'],
    ['stock-event.print', 'fr'],
  ])('lands on Stock On Hand after %s in %s', async (answer, lang) => {
    await i18n.changeLanguage(lang);
    vi.mocked(fetchPermissionStrings).mockResolvedValue([
      ...grants,
      `STOCK_CARDS_VIEW|${HOME}|${FP}`,
    ]);
    vi.mocked(fetchEventStockCards).mockResolvedValue([
      {
        stockOnHand: 50,
        orderable: { id: 'product', productCode: 'C1', fullProductName: 'Aspirin', netContent: 16 },
        lot: null,
      },
    ]);
    vi.mocked(submitStockEvent).mockResolvedValue('event-id');
    vi.mocked(fetchStockEventReport).mockResolvedValue(new Blob(['report']));
    const user = userEvent.setup();
    const { router } = renderRoute(`${PICKER}/${FP}`);
    await user.click(await screen.findByRole('button', { name: 'stock-events.add' }));
    const destination = document.getElementById('lines[0].destination') as HTMLElement;
    await user.click(destination);
    await user.click(await screen.findByRole('option', { name: 'CHW' }));
    fireEvent.change(
      document.querySelector('[name="lines[0].quantity.doses"]') as HTMLInputElement,
      { target: { value: '2' } },
    );
    await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
    await user.click(await screen.findByRole('button', { name: 'stock-events.confirm' }));
    expect(await screen.findByText('stock-issue.print-title')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`${PICKER}/${FP}`);
    const reload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(reload);
    expect(reload.defaultPrevented).toBe(false);
    await user.click(screen.getByRole('button', { name: answer }));
    expect(await screen.findByRole('heading', { name: 'Stock landing' })).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({
      mode: 'my',
      facilityId: HOME,
      programId: FP,
    });
    if (answer === 'stock-event.print') {
      await waitFor(() =>
        expect(fetchStockEventReport).toHaveBeenCalledWith('event-id', { showInDoses: true, lang }),
      );
    } else expect(fetchStockEventReport).not.toHaveBeenCalled();
  });
});
