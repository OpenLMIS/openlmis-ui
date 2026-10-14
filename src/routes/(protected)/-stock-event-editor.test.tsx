import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  fireEvent,
  type RenderOptions,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { ErrorFallback } from '@/components/error-fallback';
import { canOpen } from '@/components/nav-access';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchApprovedProducts,
  fetchFacility,
  fetchFacilityOrderableFulfills,
  fetchLotsByTradeItems,
  fetchOrderablesByIds,
  fetchReasons,
  fetchUserPrograms,
  fetchUserRecord,
  fetchValidAssignments,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import { homeFacilityOptions, userRecordOptions } from '@/features/reference-data/api/queries';
import type { Facility } from '@/features/reference-data/lib/types';
import {
  fetchEventStockCards,
  fetchEventStockOnHand,
  submitStockEvent,
} from '@/features/stock-events/api/api';
import { LIVE_NAV_GROUPS } from '@/lib/config';
import { Route as ProtectedRoute } from '@/routes/(protected)/_protected';
import { Route as AdjustmentPickerRoute } from '@/routes/(protected)/_protected.stock-management.adjustments';
import { Route as AdjustmentEditorRoute } from '@/routes/(protected)/_protected.stock-management.adjustments_.$programId';
import { Route as IssuePickerRoute } from '@/routes/(protected)/_protected.stock-management.issue';
import { Route as IssueEditorRoute } from '@/routes/(protected)/_protected.stock-management.issue_.$programId';
import { Route as ReceivePickerRoute } from '@/routes/(protected)/_protected.stock-management.receive';
import { Route as ReceiveEditorRoute } from '@/routes/(protected)/_protected.stock-management.receive_.$programId';
import { Route as UnpackPickerRoute } from '@/routes/(protected)/_protected.stock-management.unpack';
import { Route as UnpackEditorRoute } from '@/routes/(protected)/_protected.stock-management.unpack_.$programId';
import { loadStockEventEditor, StockEventPending } from '@/routes/(protected)/-stock-event-editor';
import { expectRouteWarning } from '@/tests/expect-route-warning';
import { renderPage } from '@/tests/render-page';

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/app-shell-skeleton', () => ({
  AppShellSkeleton: () => <p>Checking access</p>,
}));

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchReasons: vi.fn(),
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
}));

vi.mock('@/lib/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/runtime-config')>()),
  getKitUnpackReasonIds: vi.fn(() => ({
    kitUnpackReasonId: 'unpack',
    unpackedFromKitReasonId: 'contents',
  })),
}));

const USER = 'a337ec45-31a0-4f2b-9b2e-a105c4b669bb';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const EM = '10845cb9-d365-4aaa-badd-b4fa39c6a26a';
const ASPIRIN = { id: 'product', productCode: 'C1', fullProductName: 'Aspirin', netContent: 16 };
const KINDS = {
  adjustments: {
    eventKind: 'adjustment',
    PickerRoute: AdjustmentPickerRoute,
    EditorRoute: AdjustmentEditorRoute,
    copy: 'stock-adjustment',
    counterparty: null,
    products: 'stock-cards',
  },
  issue: {
    eventKind: 'issue',
    PickerRoute: IssuePickerRoute,
    EditorRoute: IssueEditorRoute,
    copy: 'stock-issue',
    counterparty: 'validDestinations',
    products: 'stock-cards',
  },
  unpack: {
    eventKind: 'unpack',
    PickerRoute: UnpackPickerRoute,
    EditorRoute: UnpackEditorRoute,
    copy: 'stock-unpack',
    counterparty: null,
    products: 'stock-cards',
  },
  receive: {
    eventKind: 'receive',
    PickerRoute: ReceivePickerRoute,
    EditorRoute: ReceiveEditorRoute,
    copy: 'stock-receive',
    counterparty: 'validSources',
    products: 'approved-products',
  },
} as const;
describe.each(Object.keys(KINDS) as (keyof typeof KINDS)[])('%s', (kind) => {
  const { eventKind, PickerRoute, EditorRoute, copy, counterparty, products } = KINDS[kind];
  const PICKER = `/stock-management/${kind}` as const;
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

  const renderedRoutes: { router: AnyRouter; queryClient: QueryClient; unmount: () => void }[] = [];

  function renderRoute(
    path: string = PICKER,
    renderOptions: Pick<RenderOptions, 'onCaughtError'> = {},
  ) {
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
      path: `stock-management/${kind}`,
      loader: PickerRoute.options.loader as never,
      component: PickerRoute.options.component as never,
      pendingComponent: PickerRoute.options.pendingComponent as never,
    });
    const editor = createRoute({
      getParentRoute: () => layout,
      path: `stock-management/${kind}/$programId`,
      validateSearch: EditorRoute.options.validateSearch as never,
      loader: EditorRoute.options.loader as never,
      component: EditorRoute.options.component as never,
      pendingComponent: EditorRoute.options.pendingComponent as never,
      staticData: EditorRoute.options.staticData,
    }).update({ id: `/stock-management/${kind}_/$programId` } as never);
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
        <RouterProvider router={router} />
      </QueryClientProvider>,
      renderOptions,
    );
    renderedRoutes.push({ router, queryClient, unmount: view.unmount });
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
    vi.mocked(fetchApprovedProducts).mockResolvedValue({
      content: [{ id: 'approved', orderable: { ...ASPIRIN, description: null } }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(fetchFacilityOrderableFulfills).mockResolvedValue({});
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([]);
    vi.mocked(fetchLotsByTradeItems).mockResolvedValue([]);
    vi.mocked(fetchEventStockOnHand).mockResolvedValue({});
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

  afterEach(async () => {
    for (const { router, queryClient, unmount } of renderedRoutes.splice(0)) {
      await waitFor(() => {
        expect(router.state.status).toBe('idle');
        expect(router.state.isLoading).toBe(false);
      });
      await act(async () => {
        unmount();
        await queryClient.cancelQueries();
        queryClient.clear();
      });
    }
    cleanup();
    useLoginData.setState({ referenceDataUserId: null });
  });

  describe(`${kind} program picker`, () => {
    it('lists granted home programs by name and links to their editors', async () => {
      const user = userEvent.setup();
      const { router } = renderRoute();

      const table = await screen.findByRole('table');
      expect(
        within(table)
          .getAllByRole('row')
          .slice(1)
          .map((row) => row.textContent),
      ).toEqual([`Essential Meds${copy}.make`, `Family Planning${copy}.make`]);
      const row = screen.getByText('Essential Meds').closest('tr') as HTMLElement;
      const link = within(row).getByRole('link', { name: `${copy}.make` });
      expect(link).toHaveAttribute('href', `${PICKER}/${EM}`);
      await user.click(link);

      expect(
        await screen.findByRole('heading', { name: `${copy}.editor-title` }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(`${PICKER}/${EM}`);
      expect(fetchFacility).toHaveBeenCalledWith(HOME);
    });

    it('refuses the page before fetching lookups when the right is absent', async () => {
      const assertRouteWarning = expectRouteWarning(
        `/(protected)/_protected/stock-management/${kind}${PICKER}`,
      );
      const onCaughtError = vi.fn((caught: unknown) => {
        expect(caught).toBeInstanceOf(ForbiddenError);
        expect(caught).toHaveProperty('message', 'Missing right STOCK_ADJUST');
      });
      vi.mocked(fetchPermissionStrings).mockResolvedValue(['STOCK_CARDS_VIEW']);
      renderRoute(PICKER, { onCaughtError });

      expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
      expect(fetchUserRecord).not.toHaveBeenCalled();
      expect(fetchUserPrograms).not.toHaveBeenCalled();
      expect(fetchFacility).not.toHaveBeenCalled();
      expect(onCaughtError).toHaveBeenCalled();
      assertRouteWarning();
    });

    it(`hides the ${kind} navigation entry without the adjustment right`, () => {
      expect(JSON.stringify(LIVE_NAV_GROUPS)).toContain(PICKER);
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
      const failure = new Error('Unavailable');
      const onCaughtError = vi.fn((caught: unknown) => expect(caught).toBe(failure));
      vi.mocked(fetchFacility).mockRejectedValueOnce(failure);
      const user = userEvent.setup();
      renderRoute(PICKER, { onCaughtError });

      expect(await screen.findByText('stock-programs.load-error-title')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Try Again' }));

      expect(await screen.findByText('Family Planning')).toBeInTheDocument();
      expect(onCaughtError).toHaveBeenCalled();
    });

    it('renders the heading and loading table while the facility request is pending', async () => {
      vi.mocked(fetchFacility).mockReturnValue(new Promise(() => {}));
      renderRoute();

      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(await screen.findByRole('table')).toBeInTheDocument();
      expect(screen.queryByText('Essential Meds')).not.toBeInTheDocument();
    });
  });

  if (kind === 'adjustments') {
    it('submits with a signature and lands directly on Stock On Hand without offering print', async () => {
      vi.mocked(fetchPermissionStrings).mockResolvedValue([
        ...grants,
        `STOCK_CARDS_VIEW|${HOME}|${FP}`,
      ]);
      vi.mocked(fetchEventStockCards).mockResolvedValue([
        { stockOnHand: 50, orderable: ASPIRIN, lot: null },
      ]);
      vi.mocked(fetchValidReasons).mockResolvedValue([
        {
          id: 'assignment',
          hidden: false,
          reason: {
            id: 'lost',
            name: 'Lost',
            reasonType: 'DEBIT',
            reasonCategory: 'ADJUSTMENT',
            isFreeTextAllowed: false,
            tags: [],
          },
        },
      ]);
      vi.mocked(submitStockEvent).mockResolvedValue('event-id');
      const user = userEvent.setup();
      const { router } = renderRoute(`${PICKER}/${FP}`);
      const add = await screen.findByRole('button', { name: 'stock-events.add' });
      await waitFor(() => expect(add).toBeEnabled());
      await user.click(add);
      await user.click(document.getElementById('lines[0].reasonId') as HTMLElement);
      await user.click(await screen.findByRole('option', { name: 'Lost' }));
      fireEvent.change(
        document.querySelector('[name="lines[0].quantity.doses"]') as HTMLInputElement,
        { target: { value: '2' } },
      );
      await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
      await user.type(
        await screen.findByRole('textbox', { name: 'stock-events.signature' }),
        'Ada',
      );
      await user.click(screen.getByRole('button', { name: 'stock-events.confirm' }));
      expect(await screen.findByRole('heading', { name: 'Stock landing' })).toBeInTheDocument();
      expect(router.state.location.search).toMatchObject({
        mode: 'my',
        facilityId: HOME,
        programId: FP,
      });
      expect(submitStockEvent).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ signature: 'Ada', eventOrigin: 'ADJUSTMENT' }),
      );
    });
  }

  if (kind === 'unpack') return;

  describe(`${kind} editor access`, () => {
    it('uses cached facility and program names in the pending editor without fetching them again', async () => {
      const i18n = createInstance();
      await i18n.use(ICU).init({
        lng: 'en',
        resources: { en: { translation: en } },
        keySeparator: false,
      });
      const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: Infinity } },
      });
      queryClient.setQueryData(userRecordOptions(USER).queryKey, {
        id: USER,
        username: 'administrator',
        firstName: 'Admin',
        lastName: 'Istrator',
        active: true,
        roleAssignments: [],
        homeFacilityId: HOME,
      });
      queryClient.setQueryData(homeFacilityOptions(HOME).queryKey, homeFacility);
      const router = renderPage(
        <I18nextProvider i18n={i18n}>
          <StockEventPending kind={eventKind} programId={FP} />
        </I18nextProvider>,
        { queryClient },
      );
      try {
        const title = await screen.findByRole('heading', { level: 1 });
        expect(title).toHaveTextContent('Comfort Health Clinic');
        expect(title).toHaveTextContent('Family Planning');
        expect(title).toHaveTextContent('HC01');
        expect(fetchFacility).not.toHaveBeenCalled();
        expect(fetchUserRecord).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
      } finally {
        router.update({ context: {} });
        queryClient.clear();
      }
    });

    it('starts the user record while editor permissions are still pending', async () => {
      let finish!: (permissions: string[]) => void;
      vi.mocked(fetchPermissionStrings).mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const loading = loadStockEventEditor(queryClient, FP, eventKind);
      const started = vi.mocked(fetchUserRecord).mock.calls.length;
      finish(grants);
      await loading;
      expect(started).toBe(1);
    });

    it('removes old lines while new rights are pending and loads a fresh draft for the same facility', async () => {
      const rights = [...grants, `STOCK_CARDS_VIEW|${HOME}|${FP}`];
      vi.mocked(fetchPermissionStrings).mockResolvedValue(rights);
      vi.mocked(fetchEventStockCards).mockResolvedValue([
        {
          stockOnHand: 50,
          orderable: ASPIRIN,
          lot: null,
        },
      ]);
      const user = userEvent.setup();
      renderRoute(`${PICKER}/${FP}`);
      await user.click(await screen.findByRole('combobox', { name: 'stock-events.product' }));
      await user.click(await screen.findByRole('option', { name: 'Aspirin' }));
      await user.click(screen.getByRole('button', { name: 'stock-events.add' }));
      const quantity = document.querySelector(
        '[name="lines[0].quantity.doses"]',
      ) as HTMLInputElement;
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
      await screen.findByRole('heading', { name: `${copy}.editor-title` });
      expect(document.querySelector('[name="lines[0].quantity.doses"]')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled();
    });

    it('drops the old loader scope and rechecks rights after a user change', async () => {
      const assertRouteWarning = expectRouteWarning(
        `/(protected)/_protected/stock-management/${kind}_/$programId${PICKER}/${FP}`,
      );
      const onCaughtError = vi.fn((caught: unknown) => {
        expect(caught).toBeInstanceOf(ForbiddenError);
        expect(caught).toHaveProperty('message', 'Missing right STOCK_ADJUST');
      });
      renderRoute(`${PICKER}/${FP}`, { onCaughtError });
      await screen.findByRole('heading', { name: `${copy}.editor-title` });
      vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
      act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
      expect(
        screen.queryByRole('heading', { name: `${copy}.editor-title` }),
      ).not.toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
      await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalledWith('other'));
      expect(onCaughtError).toHaveBeenCalled();
      assertRouteWarning();
    });

    it('explains missing scoped stock view access without loading stock cards', async () => {
      vi.mocked(fetchPermissionStrings).mockResolvedValue([
        ...grants,
        `STOCK_CARDS_VIEW|away|${FP}`,
      ]);
      renderRoute(`${PICKER}/${FP}`);
      expect(await screen.findByText('stock-events.no-stock-view-description')).toBeInTheDocument();
      expect(fetchEventStockCards).not.toHaveBeenCalled();
      expect(fetchApprovedProducts).not.toHaveBeenCalled();
      expect(fetchValidReasons).not.toHaveBeenCalled();
    });

    it('prefetches stock and reasons for the granted home facility and program', async () => {
      vi.mocked(fetchPermissionStrings).mockResolvedValue([
        ...grants,
        `STOCK_CARDS_VIEW|${HOME}|${FP}`,
      ]);
      renderRoute(`${PICKER}/${FP}`);
      await screen.findByRole('heading', { name: `${copy}.editor-title` });
      if (products === 'stock-cards') {
        expect(fetchEventStockCards).toHaveBeenCalledWith({ facilityId: HOME, programId: FP });
        expect(fetchApprovedProducts).not.toHaveBeenCalled();
      } else {
        expect(fetchApprovedProducts).toHaveBeenCalledWith({
          facilityId: HOME,
          programId: FP,
          name: '',
          page: 0,
          size: 50,
        });
        expect(fetchFacilityOrderableFulfills).toHaveBeenCalledWith({
          facilityId: HOME,
          programId: FP,
        });
        expect(fetchEventStockCards).not.toHaveBeenCalled();
      }
      expect(fetchValidReasons).toHaveBeenCalledWith({ program: FP, facilityType: 'type' });
      if (counterparty)
        expect(fetchValidAssignments).toHaveBeenCalledWith(counterparty, {
          facilityId: HOME,
          programId: FP,
        });
      else expect(fetchValidAssignments).not.toHaveBeenCalled();
    });

    it.each([
      ['an unscoped right', ['STOCK_ADJUST']],
      ['a grant at another facility', [`STOCK_ADJUST|away|${FP}`]],
      ['a grant for another program', [`STOCK_ADJUST|${HOME}|${EM}`]],
    ])('shows No Access for %s', async (_name, permissions) => {
      const assertRouteWarning = expectRouteWarning(
        `/(protected)/_protected/stock-management/${kind}_/$programId${PICKER}/${FP}`,
      );
      const onCaughtError = vi.fn((caught: unknown) => {
        expect(caught).toBeInstanceOf(ForbiddenError);
        expect(caught).toHaveProperty('message', 'Missing right STOCK_ADJUST');
      });
      vi.mocked(fetchPermissionStrings).mockResolvedValue(permissions);
      renderRoute(`${PICKER}/${FP}`, { onCaughtError });

      expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
      expect(screen.queryByText(`${copy}.editor-title`)).not.toBeInTheDocument();
      expect(onCaughtError).toHaveBeenCalled();
      assertRouteWarning();
    });

    it('shows No Access for a program the home facility does not support', async () => {
      const assertRouteWarning = expectRouteWarning(
        `/(protected)/_protected/stock-management/${kind}_/$programId${PICKER}/${FP}`,
      );
      const onCaughtError = vi.fn((caught: unknown) => {
        expect(caught).toBeInstanceOf(ForbiddenError);
        expect(caught).toHaveProperty('message', 'Missing right STOCK_ADJUST');
      });
      vi.mocked(fetchFacility).mockResolvedValue({ ...homeFacility, supportedPrograms: [] });
      renderRoute(`${PICKER}/${FP}`, { onCaughtError });

      expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
      expect(onCaughtError).toHaveBeenCalled();
      assertRouteWarning();
    });

    it('shows No Access without a home facility', async () => {
      const assertRouteWarning = expectRouteWarning(
        `/(protected)/_protected/stock-management/${kind}_/$programId${PICKER}/${FP}`,
      );
      const onCaughtError = vi.fn((caught: unknown) => {
        expect(caught).toBeInstanceOf(ForbiddenError);
        expect(caught).toHaveProperty('message', 'Missing right STOCK_ADJUST');
      });
      vi.mocked(fetchUserRecord).mockResolvedValue({
        id: USER,
        username: 'administrator',
        firstName: 'Admin',
        lastName: 'Istrator',
        active: true,
        homeFacilityId: null,
        roleAssignments: [],
      });
      renderRoute(`${PICKER}/${FP}`, { onCaughtError });

      expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
      expect(fetchFacility).not.toHaveBeenCalled();
      expect(onCaughtError).toHaveBeenCalled();
      assertRouteWarning();
    });

    it('keeps valid paging and keyword state in the URL', async () => {
      const { router } = renderRoute(`${PICKER}/${FP}?page=2&size=20&keyword=lot`);

      await screen.findByRole('heading', { name: `${copy}.editor-title` });
      expect(router.state.location.search).toMatchObject({ page: 2, size: 20, keyword: 'lot' });
    });

    it('drops invalid paging and blank keywords to their defaults', async () => {
      const { router } = renderRoute(`${PICKER}/${FP}?page=-1&size=101&keyword=%20`);

      await screen.findByRole('heading', { name: `${copy}.editor-title` });
      const search = router.state.matches.at(-1)?.search;
      expect(search).toEqual({ page: undefined, size: undefined });
    });

    it('leaves default paging and an empty keyword out of navigation links', async () => {
      const { router } = renderRoute(`${PICKER}/${FP}`);
      await screen.findByRole('heading', { name: `${copy}.editor-title` });

      await act(() =>
        router.navigate({
          to: `/stock-management/${kind}/$programId`,
          params: { programId: FP },
          search: { page: 1, size: 10, keyword: '' },
        }),
      );

      expect(router.state.location.searchStr).toBe('');
    });
  });
});

describe('Unpack policies', () => {
  const program = { id: FP, code: 'FP', name: 'Family Planning', active: true };
  beforeEach(() => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: USER, username: 'ada', accessToken: 'token' });
    vi.mocked(fetchPermissionStrings).mockResolvedValue([
      `STOCK_ADJUST|${HOME}|${FP}`,
      `STOCK_CARDS_VIEW|${HOME}|${FP}`,
    ]);
    vi.mocked(fetchUserRecord).mockResolvedValue({
      id: USER,
      username: 'ada',
      firstName: 'Ada',
      lastName: '',
      active: true,
      homeFacilityId: HOME,
      roleAssignments: [],
    });
    vi.mocked(fetchUserPrograms).mockResolvedValue([program]);
    vi.mocked(fetchFacility).mockResolvedValue({
      id: HOME,
      code: 'HC',
      name: 'Clinic',
      active: true,
      enabled: true,
      type: { id: 'type', code: 'HC', name: 'Health Center' },
      geographicZone: { id: 'zone', code: 'Z', name: 'Zone', level: { name: 'District' } },
      supportedPrograms: [{ ...program, supportActive: true, supportLocallyFulfilled: false }],
    });
    vi.mocked(fetchReasons).mockResolvedValue([]);
    vi.mocked(fetchEventStockCards).mockResolvedValue([]);
  });
  afterEach(() => {
    cleanup();
    useLoginData.setState({ referenceDataUserId: null });
  });

  it('prefetches stock cards and the reasons list without valid reasons or destinations', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    try {
      await loadStockEventEditor(client, FP, 'unpack');
      expect(fetchEventStockCards).toHaveBeenCalledWith({ facilityId: HOME, programId: FP });
      expect(fetchReasons).toHaveBeenCalledOnce();
      expect(fetchValidReasons).not.toHaveBeenCalled();
      expect(fetchValidAssignments).not.toHaveBeenCalled();
    } finally {
      await client.cancelQueries();
      client.clear();
    }
  });

  function renderUnpackRoute(path = '/stock-management/unpack') {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
    const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
    const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
    const picker = createRoute({
      getParentRoute: () => layout,
      path: 'stock-management/unpack',
      loader: UnpackPickerRoute.options.loader as never,
      component: UnpackPickerRoute.options.component as never,
    });
    const editor = createRoute({
      getParentRoute: () => layout,
      path: 'stock-management/unpack/$programId',
      validateSearch: UnpackEditorRoute.options.validateSearch as never,
      loader: UnpackEditorRoute.options.loader as never,
      component: UnpackEditorRoute.options.component as never,
      pendingComponent: UnpackEditorRoute.options.pendingComponent as never,
      staticData: UnpackEditorRoute.options.staticData,
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
      history: createMemoryHistory({ initialEntries: [path] }),
    } as never) as AnyRouter;
    const view = render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    return { router, queryClient, ...view };
  }

  it('lands on Stock On Hand for the home facility and program after confirmation', async () => {
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
    const { router, queryClient, unmount } = renderUnpackRoute(`/stock-management/unpack/${FP}`);
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
      await act(async () => {
        unmount();
        await queryClient.cancelQueries();
        queryClient.clear();
      });
    }
  });
});
