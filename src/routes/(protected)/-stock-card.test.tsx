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
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { fetchStockCard, fetchStockCardReport } from '@/features/stock-card/api/api';
import { stockCardOptions } from '@/features/stock-card/api/queries';
import type { StockCard } from '@/features/stock-card/lib/types';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { openReport } from '@/lib/open-report';
import { Route } from '@/routes/(protected)/_protected.stock-management.stock-on-hand_.$stockCardId';
import { expectRouteWarning } from '@/test-utils/expect-route-warning';
import { seedHomeStock } from '@/test-utils/home-stock';
import { httpError } from '@/test-utils/http-error';

vi.mock('@/features/reference-data/api/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/reference-data/api/api')>()),
  fetchCurrencySettings: vi.fn(async () => ({ timeZoneId: 'UTC' })),
  fetchUserRecord: vi.fn(async () => ({
    id: USER,
    username: 'user',
    firstName: '',
    lastName: '',
    active: true,
    roleAssignments: [],
    homeFacilityId: HOME,
  })),
  fetchUserPrograms: vi.fn(async () => [{ ...card.program, active: true }]),
  fetchFacility: vi.fn(async () => ({
    ...card.facility,
    type: { id: 'type' },
    supportedPrograms: [{ id: FP }],
  })),
}));
vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/stock-card/api/api', () => ({
  fetchStockCard: vi.fn(),
  fetchStockCardReport: vi.fn(),
}));
const deliver = vi.fn();
vi.mock('@/lib/open-report', () => ({ openReport: vi.fn(() => ({ deliver, close: vi.fn() })) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/app-shell/nav-access', () => ({ useCanOpen: () => () => true }));

const CARD_MATCH_ID =
  '/(protected)/_protected/stock-management/stock-on-hand/$stockCardId/stock-management/stock-on-hand/card1';
const USER = 'user1';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const EM = '10845cb9-d365-4aaa-badd-b4fa39c6a26a';
const card: StockCard = {
  id: 'card1',
  facility: { id: HOME, name: 'Comfort Health Clinic', code: 'HC01' },
  program: { id: FP, name: 'Family Planning', code: 'PRG001' },
  orderable: {
    id: 'o1',
    productCode: 'C1',
    fullProductName: 'Vaccine',
    netContent: 5,
    dispensable: { displayUnit: 'each' },
  },
  lot: { id: 'l1', lotCode: 'LOT-A', expirationDate: '2027-01-31' },
  stockOnHand: 23,
  active: false,
  lineItems: [{ id: 'line1', occurredDate: '2026-01-01', quantity: 23, stockOnHand: 23 }],
};
const grants = [`STOCK_CARDS_VIEW|${HOME}|${FP}`];
const appQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  });
const path = (extra = '') => `/stock-management/stock-on-hand/card1${extra}`;

function renderRoute(
  location = path(),
  queryClient = appQueryClient(),
  renderOptions: Pick<RenderOptions, 'onCaughtError'> = {},
) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const page = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/stock-on-hand/$stockCardId',
    validateSearch: Route.options.validateSearch as never,
    loader: Route.options.loader as never,
    component: Route.options.component as never,
    errorComponent: Route.options.errorComponent as never,
    pendingComponent: Route.options.pendingComponent as never,
    staticData: Route.options.staticData,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([page] as never)] as never),
    ] as never),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [location] }),
  } as never) as AnyRouter;
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    renderOptions,
  );
  return { router, queryClient, unmount: view.unmount };
}

beforeEach(async () => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: USER });
  await getLocalDb().table(LOCAL_TABLES.stockCardHistory).clear();
  vi.mocked(fetchPermissionStrings).mockResolvedValue(grants);
  vi.mocked(fetchStockCard).mockResolvedValue(card);
});
afterEach(() => {
  cleanup();
  useLoginData.setState({ referenceDataUserId: null });
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('stock card route', () => {
  it.each([true, false])('rechecks the card for a changed user, grant=%s', async (allowed) => {
    const assertRouteWarning = allowed ? undefined : expectRouteWarning(CARD_MATCH_ID);
    const onCaughtError = vi.fn((caught: unknown) => {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect(caught).toHaveProperty('message', 'Missing right STOCK_CARDS_VIEW');
    });
    renderRoute(path(), undefined, allowed ? {} : { onCaughtError });
    await screen.findByText('Vaccine - each');
    vi.mocked(fetchPermissionStrings).mockResolvedValue(allowed ? grants : []);
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, stockOnHand: 999 });
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    if (allowed) expect(await screen.findByText('999')).toBeInTheDocument();
    else
      expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(fetchPermissionStrings).toHaveBeenCalledWith('other');
    expect(fetchStockCard).toHaveBeenCalledTimes(2);
    if (!allowed) expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning?.();
  });

  it('loads for the new user when the first load fails after a user change', async () => {
    let fail: (error: unknown) => void = () => {};
    vi.mocked(fetchStockCard).mockReturnValueOnce(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    renderRoute();
    await waitFor(() => expect(fetchStockCard).toHaveBeenCalledTimes(1));
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, stockOnHand: 999 });
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    await act(async () => fail(httpError(500)));

    expect(await screen.findByText('999')).toBeInTheDocument();
    expect(fetchPermissionStrings).toHaveBeenCalledWith('other');
    expect(screen.queryByText('stock-card.error-title')).not.toBeInTheDocument();
  });

  it('returns from Not Found with the same list search as the breadcrumb', async () => {
    const assertRouteWarning = expectRouteWarning(CARD_MATCH_ID);
    const failure = httpError(404);
    const onCaughtError = vi.fn((caught: unknown) => expect(caught).toBe(failure));
    vi.mocked(fetchStockCard).mockRejectedValue(failure);
    renderRoute(
      path(`?facilityId=${HOME}&programId=${FP}&productCode=C1&page=7&cardPage=2`),
      undefined,
      { onCaughtError },
    );
    const back = await screen.findByRole('button', { name: 'stock-card.back' });
    expect(back).toHaveAttribute(
      'href',
      screen
        .getByRole('link', {
          name: 'nav.stock-management.stock-on-hand',
        })
        .getAttribute('href'),
    );
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
  });

  it('opens an inactive card when the exact facility and program grant exists', async () => {
    renderRoute();
    expect(await screen.findByRole('heading', { name: 'stock-card.title' })).toBeInTheDocument();
    expect(await screen.findByText('Vaccine - each')).toBeInTheDocument();
    expect(fetchStockCard).toHaveBeenCalledWith('card1');
  });

  it('checks the card pair rather than the facility and program in the return search', async () => {
    const assertRouteWarning = expectRouteWarning(CARD_MATCH_ID);
    const onCaughtError = vi.fn((caught: unknown) => {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect(caught).toHaveProperty('message', 'Missing right STOCK_CARDS_VIEW');
    });
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, program: { ...card.program, id: EM } });
    renderRoute(path(`?facilityId=${HOME}&programId=${FP}&mode=my`), undefined, { onCaughtError });
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(screen.queryByText('Vaccine - each')).not.toBeInTheDocument();
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
  });

  it.each([
    { permissions: [] },
    { permissions: ['STOCK_CARDS_VIEW'] },
    { permissions: [`STOCK_CARDS_VIEW|another-facility|${FP}`] },
  ])('refuses missing or differently scoped grants: %j', async ({ permissions }) => {
    const assertRouteWarning = expectRouteWarning(CARD_MATCH_ID);
    const onCaughtError = vi.fn((caught: unknown) => {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect(caught).toHaveProperty('message', 'Missing right STOCK_CARDS_VIEW');
    });
    vi.mocked(fetchPermissionStrings).mockResolvedValue(permissions);
    renderRoute(path(), undefined, { onCaughtError });
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(screen.queryByText('Vaccine - each')).not.toBeInTheDocument();
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
  });

  it.each([400, 404])('shows Not Found for status %i', async (status) => {
    const assertRouteWarning = expectRouteWarning(CARD_MATCH_ID);
    const failure = httpError(status);
    const onCaughtError = vi.fn((caught: unknown) => expect(caught).toBe(failure));
    vi.mocked(fetchStockCard).mockRejectedValue(failure);
    renderRoute(path(), undefined, { onCaughtError });
    expect(await screen.findByText('stock-card.not-found-title')).toBeInTheDocument();
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
  });

  it('shows No Access for a server refusal', async () => {
    const assertRouteWarning = expectRouteWarning(CARD_MATCH_ID);
    const failure = httpError(403);
    const onCaughtError = vi.fn((caught: unknown) => expect(caught).toBe(failure));
    vi.mocked(fetchStockCard).mockRejectedValue(failure);
    renderRoute(path(), undefined, { onCaughtError });
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
  });

  it('shows a load failure with retry for other server errors', async () => {
    const assertRouteWarning = expectRouteWarning(CARD_MATCH_ID);
    const failure = httpError(500);
    const onCaughtError = vi.fn((caught: unknown) => expect(caught).toBe(failure));
    vi.mocked(fetchStockCard).mockRejectedValue(failure);
    renderRoute(path(), undefined, { onCaughtError });
    expect(
      await screen.findByRole('heading', { name: 'stock-card.error-title' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'error.try-again' })).toBeInTheDocument();
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
  });

  it('starts the card request while permissions are still loading', async () => {
    let release = () => {};
    vi.mocked(fetchPermissionStrings).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(grants);
      }),
    );
    renderRoute();
    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalled());
    expect(fetchStockCard).toHaveBeenCalledWith('card1');
    await act(async () => release());
    expect(await screen.findByText('Vaccine - each')).toBeInTheDocument();
  });

  it('does not reveal a late card after the user changes', async () => {
    const assertRouteWarning = expectRouteWarning(CARD_MATCH_ID);
    const onCaughtError = vi.fn((caught: unknown) => {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect(caught).toHaveProperty('message', 'Missing right STOCK_CARDS_VIEW');
    });
    let release = () => {};
    vi.mocked(fetchStockCard).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(card);
      }),
    );
    const { router } = renderRoute(path(), undefined, { onCaughtError });
    await waitFor(() => expect(fetchStockCard).toHaveBeenCalled());
    vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    await act(async () => release());
    await waitFor(() => expect(router.state.status).toBe('idle'));
    expect(screen.queryByText('Vaccine - each')).not.toBeInTheDocument();
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
  });
});

const manyLines = Array.from({ length: 25 }, (_, index) => ({
  id: `line${index}`,
  occurredDate: '2026-01-01',
  quantity: index,
  stockOnHand: index,
  username: `person${index}`,
}));

describe('stock card display and paging', () => {
  it('shows header fields in legacy order, with a lot and the stored expiry day', async () => {
    renderRoute();
    const header = await screen.findByRole('region', { name: 'Vaccine - each' });
    expect(
      within(header)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual([
      'stock-card.product-code',
      'stock-card.pack-size',
      'stock-card.facility',
      'stock-card.program',
      'stock-card.stock-on-hand',
      'stock-card.lot-number',
      'stock-card.expiry-date',
    ]);
    expect(within(header).getByText('LOT-A')).toBeInTheDocument();
    expect(within(header).getByText('Jan 31, 2027')).toBeInTheDocument();
  });

  it('omits lot fields for a card without a lot', async () => {
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, lot: null });
    renderRoute();
    const header = await screen.findByRole('region', { name: 'Vaccine - each' });
    expect(within(header).queryByText('stock-card.lot-number')).not.toBeInTheDocument();
    expect(within(header).queryByText('stock-card.expiry-date')).not.toBeInTheDocument();
  });

  it('pages newest first from a shared URL, independently from the list page', async () => {
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, lineItems: manyLines });
    const { router } = renderRoute(path('?cardPage=3&page=7&size=20'));
    expect(await screen.findByText('person4')).toBeInTheDocument();
    expect(screen.queryByText('person24')).not.toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ cardPage: 3, page: 7, size: 20 });
    expect(fetchStockCard).toHaveBeenCalledTimes(1);
  });

  it('clamps a page past the end and keeps list paging and filters', async () => {
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, lineItems: manyLines });
    const { router } = renderRoute(path('?cardPage=99&page=7&productCode=C1'));
    expect(await screen.findByText('person4')).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        cardPage: 3,
        page: 7,
        productCode: 'C1',
      }),
    );
    expect(fetchStockCard).toHaveBeenCalledTimes(1);
  });

  it('changes pages and returns with Back without fetching the card again', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, lineItems: manyLines });
    const { router } = renderRoute();
    await screen.findByText('person24');
    await user.click(screen.getByRole('button', { name: 'Next Page' }));
    expect(await screen.findByText('person14')).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ cardPage: 2 });
    await act(() => router.history.back());
    expect(await screen.findByText('person24')).toBeInTheDocument();
    expect(fetchStockCard).toHaveBeenCalledTimes(1);
  });

  it('opens a new page of cards at its first card', async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 390,
    } as DOMRect);
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    onTestFinished(() => {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    });
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, lineItems: manyLines });
    renderRoute();
    await screen.findByText('person24');
    expect(scrollIntoView).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Next Page' }));
    await screen.findByText('person14');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('changes header and row quantities together when packs are chosen', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByText('Vaccine - each');
    await user.click(screen.getByRole('radio', { name: 'quantity-unit.packs' }));
    expect(screen.getAllByText('4 ( +3 )')).toHaveLength(3);
  });

  it('shows the columns in legacy order, Signature and the reversals hidden until turned on', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    const headers = () =>
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent);
    width.mockReturnValue({ width: 1400 } as DOMRect);
    renderRoute();
    await screen.findByRole('table');
    expect(headers()).toEqual([
      'stock-card.date',
      'stock-card.receive-from',
      'stock-card.issue-to',
      'stock-card.reason',
      'stock-card.adjustment',
      'stock-card.stock-on-hand',
      'stock-card.performed-by',
      'stock-card.document-number',
    ]);
  });

  it('shows each line as a card on phones, with who stock moved to or from and its document', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 390,
    } as DOMRect);
    vi.mocked(fetchStockCard).mockResolvedValue({
      ...card,
      lineItems: [
        {
          id: 'line1',
          occurredDate: '2026-01-01',
          quantity: 23,
          stockOnHand: 23,
          source: { name: 'Depot' },
          username: 'clerk',
          signature: 'signed',
          eventOrigin: 'RECEIVE',
          originEventId: 'event0',
          documentNumber: 'DOC-1',
        },
      ],
    });
    renderRoute();
    const line = (await screen.findByText('stock-card.adjustment')).closest('li') as HTMLElement;
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      within(line)
        .getAllByText(/^stock-card\./)
        .map((label) => label.textContent),
    ).toEqual([
      'stock-card.receive-from',
      'stock-card.issue-to',
      'stock-card.reason',
      'stock-card.adjustment',
      'stock-card.stock-on-hand',
      'stock-card.performed-by',
      'stock-card.document-number',
    ]);
    expect(within(line).getAllByText(EMPTY_VALUE)).toHaveLength(2);
    expect(within(line).getByRole('link', { name: 'DOC-1' })).toBeInTheDocument();
  });

  it('shows the document links on a laptop, and each reversal column the card has values for', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960,
    } as DOMRect);
    vi.mocked(fetchStockCard).mockResolvedValue({
      ...card,
      lineItems: [
        {
          id: 'line1',
          occurredDate: '2026-01-01',
          quantity: 23,
          stockOnHand: 23,
          eventOrigin: 'ISSUE',
          originEventId: 'event0',
          documentNumber: 'DOC-1',
          cancellationEventId: 'event2',
          cancellationEventDocumentNumber: 'DOC-3',
        },
      ],
    });
    renderRoute();
    const table = await screen.findByRole('table');
    await within(table).findByText('DOC-1');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toContain('stock-card.document-number');
    expect(headers).toContain('stock-card.reversed-by');
    expect(headers).not.toContain('stock-card.reversing');
  });

  it.each([800, 390])(
    'brings a hidden column back from the View menu at content width %i',
    async (width) => {
      const user = userEvent.setup();
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        width,
      } as DOMRect);
      vi.mocked(fetchStockCard).mockResolvedValue({
        ...card,
        lineItems: [
          {
            id: 'line1',
            occurredDate: '2026-01-01',
            quantity: 23,
            stockOnHand: 23,
            signature: 'signed',
          },
        ],
      });
      renderRoute();
      await screen.findByText('stock-card.adjustment');
      expect(screen.queryByText('signed')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'View' }));
      await user.click(
        await screen.findByRole('menuitemcheckbox', { name: 'stock-card.signature' }),
      );
      expect(await screen.findByText('signed')).toBeInTheDocument();
    },
  );

  it('links each document to its event, keeping the facility and program for the way back', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1400,
    } as DOMRect);
    localStorage.setItem(
      'stock-card.column-visibility',
      JSON.stringify({ reversing: true, reversedBy: true }),
    );
    vi.mocked(fetchStockCard).mockResolvedValue({
      ...card,
      lineItems: [
        {
          id: 'line1',
          occurredDate: '2026-01-01',
          quantity: 23,
          stockOnHand: 23,
          eventOrigin: 'ISSUE',
          originEventId: 'event0',
          documentNumber: 'DOC-1',
          reversedEventId: 'event1',
          cancellationEventId: 'event2',
          cancellationEventDocumentNumber: 'DOC-3',
        },
      ],
    });
    renderRoute(path(`?mode=my&programId=${FP}&facilityId=${HOME}&productCode=C1&cardPage=1`));

    const back = `?mode=my&programId=${FP}&facilityId=${HOME}`;
    expect(await screen.findByRole('link', { name: 'DOC-1' })).toHaveAttribute(
      'href',
      `/stock-management/transaction-history/event0${back}`,
    );
    expect(screen.getByRole('link', { name: 'stock-card.view-reversing' })).toHaveAttribute(
      'href',
      `/stock-management/transaction-history/event1${back}`,
    );
    expect(screen.getByRole('link', { name: 'DOC-3' })).toHaveAttribute(
      'href',
      `/stock-management/transaction-history/event2${back}`,
    );
  });

  it('leaves missing table values blank', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1400,
    } as DOMRect);
    renderRoute();
    const table = await screen.findByRole('table');
    expect(within(table).queryByText(EMPTY_VALUE)).not.toBeInTheDocument();
    expect(
      within(table)
        .getAllByRole('cell')
        .some((cell) => !cell.textContent),
    ).toBe(true);
  });

  it('shows the empty ledger and clamps its stale page to the beginning', async () => {
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, lineItems: [] });
    const { router } = renderRoute(path('?cardPage=99'));
    expect(await screen.findByText('stock-card.no-transactions')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('cardPage'));
  });
});

describe('stock card print', () => {
  it('prints the whole card in the selected unit and page language', async () => {
    const pdf = new Blob(['%PDF']);
    vi.mocked(fetchStockCardReport).mockResolvedValue(pdf);
    renderRoute();
    await userEvent.click(await screen.findByRole('radio', { name: 'quantity-unit.packs' }));
    await userEvent.click(screen.getByRole('button', { name: 'stock-card.print' }));
    await waitFor(() =>
      expect(fetchStockCardReport).toHaveBeenCalledWith('card1', {
        showInDoses: false,
        lang: 'en',
      }),
    );
    expect(openReport).toHaveBeenCalledWith('stock_card_card1.pdf', 'stock-card.print-loading');
    expect(deliver).toHaveBeenCalledWith(pdf);
  });
});

describe('stock card return breadcrumbs', () => {
  it('returns the whole validated list search after opening a shared card link', async () => {
    const search = {
      mode: 'supervised',
      facilityId: HOME,
      programId: FP,
      productCode: 'C1',
      productName: 'Vaccine',
      lotCode: 'LOT-A',
      includeInactive: 'false',
      page: '7',
      size: '20',
    };
    const { unmount } = renderRoute(path(`?${new URLSearchParams(search)}&cardPage=3&cardSize=20`));
    await screen.findByText('Vaccine - each');
    const link = screen.getByRole('link', { name: 'nav.stock-management.stock-on-hand' });
    const url = new URL((link as HTMLAnchorElement).href);
    expect(url.pathname).toBe('/stock-management/stock-on-hand');
    expect(Object.fromEntries(url.searchParams)).toEqual(search);
    unmount();
    renderRoute(path(`?${new URLSearchParams(search)}&cardPage=3&cardSize=20`));
    await screen.findByText('Vaccine - each');
    expect(
      screen.getByRole('link', { name: 'nav.stock-management.stock-on-hand' }),
    ).toHaveAttribute('href', url.pathname + url.search);
  });

  it('returns to bare Stock On Hand when the card has no list search', async () => {
    renderRoute(path('?cardPage=3&cardSize=20'));
    await screen.findByText('Vaccine - each');
    expect(
      screen.getByRole('link', { name: 'nav.stock-management.stock-on-hand' }),
    ).toHaveAttribute('href', '/stock-management/stock-on-hand');
  });
});

describe('stock card freshness', () => {
  it('fetches fresh on Try Again after a failed entry with an old cached balance', async () => {
    const assertRouteWarning = expectRouteWarning(CARD_MATCH_ID);
    const failure = httpError(500);
    const onCaughtError = vi.fn((caught: unknown) => expect(caught).toBe(failure));
    const queryClient = appQueryClient();
    const first = renderRoute(path(), queryClient);
    await screen.findByText('Vaccine - each');
    first.unmount();
    vi.mocked(fetchStockCard).mockRejectedValueOnce(failure);
    renderRoute(path(), queryClient, { onCaughtError });
    await screen.findByRole('heading', { name: 'stock-card.error-title' });
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, stockOnHand: 999 });
    await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
    expect(await screen.findByText('999')).toBeInTheDocument();
    expect(fetchStockCard).toHaveBeenCalledTimes(3);
    expect(onCaughtError).toHaveBeenCalled();
    assertRouteWarning();
  });

  it.each(['stale', 'invalidated', 'fresh'])('reloads a %s cached card on entry', async (state) => {
    const queryClient = appQueryClient();
    const first = renderRoute(path(), queryClient);
    await screen.findByText('Vaccine - each');
    first.unmount();
    const queryKey = ['stockCards', 'detail', 'card1'];
    if (state === 'stale')
      queryClient.setQueryData(queryKey, card, { updatedAt: Date.now() - 31_000 });
    if (state === 'invalidated') await queryClient.invalidateQueries({ queryKey });
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, stockOnHand: 999 });
    renderRoute(path(), queryClient);
    await screen.findByText('Vaccine - each');
    expect(fetchStockCard).toHaveBeenCalledTimes(2);
    expect(
      within(screen.getByRole('region', { name: 'Vaccine - each' })).getByText('999'),
    ).toBeInTheDocument();
  });
});

it('opens a downloaded summary offline without presenting empty transaction history', async () => {
  await seedHomeStock(card, USER);
  onlineManager.setOnline(false);
  const client = new QueryClient({
    defaultOptions: { queries: { networkMode: 'always', retry: false } },
  });
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  renderRoute(path(), client);
  expect(await screen.findByText('stock-card.offline-summary')).toBeInTheDocument();
  expect(screen.getByText('Vaccine - each')).toBeInTheDocument();
  expect(screen.getByText('LOT-A')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByText('stock-card.offline-history-unavailable-title')).toBeInTheDocument();
  expect(fetchStockCard).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'stock-card.print' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(fetchStockCard).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByText('stock-card.offline-summary')).not.toBeInTheDocument(),
  );
});

it.each([
  [false, false],
  [true, true],
])(
  'reopens viewed history as table=%s, unreachable=%s after a fresh query cache',
  async (table, unreachable) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: table ? 1400 : 400,
    } as DOMRect);
    const viewed = {
      ...card,
      lineItems: [
        {
          ...card.lineItems[0],
          source: { name: 'District Warehouse' },
          destination: { name: 'Clinic Annex' },
          reason: { name: 'Stock Transfer', reasonType: 'CREDIT', reasonCategory: 'TRANSFER' },
          username: 'Alex',
          eventOrigin: 'ADJUSTMENT',
          originEventId: 'event1',
          documentNumber: 'HISTORY-1',
        },
      ],
    } as StockCard;
    vi.mocked(fetchStockCard).mockResolvedValue(viewed);
    await seedHomeStock(card, USER);
    const first = renderRoute();
    await screen.findByText('HISTORY-1');
    const saved = await getLocalDb().table(LOCAL_TABLES.stockCardHistory).get(card.id);
    expect(saved).toMatchObject({ userId: USER, card: viewed, fetchedAt: expect.any(Number) });
    first.unmount();
    await getLocalDb().table(LOCAL_TABLES.homeStockDownloads).clear();
    vi.mocked(fetchStockCard).mockClear();
    if (unreachable)
      vi.mocked(fetchStockCard).mockRejectedValue(
        new AxiosError('Timed out', AxiosError.ECONNABORTED),
      );
    else onlineManager.setOnline(false);
    const client = new QueryClient({
      defaultOptions: { queries: { networkMode: 'always', retry: false } },
    });
    client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
    renderRoute(path(), client);
    expect(await screen.findByText('HISTORY-1')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('District Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Clinic Annex')).toBeInTheDocument();
    expect(screen.getByText('Stock Transfer')).toBeInTheDocument();
    expect(
      screen.getByText(
        unreachable ? 'stock-card.unreachable-history' : 'stock-card.offline-history',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('stock-card.offline-summary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'stock-card.print' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.click(screen.getByRole('radio', { name: 'quantity-unit.packs' }));
    expect(screen.getAllByText('4 ( +3 )').length).toBeGreaterThan(0);
    expect(fetchStockCard).toHaveBeenCalledTimes(unreachable ? 1 : 0);
  },
);

it('keeps the offline notice until a reconnect refresh replaces the downloaded card', async () => {
  await seedHomeStock(card, USER);
  const client = new QueryClient({
    defaultOptions: { queries: { networkMode: 'always', retry: false } },
  });
  client.setQueryData(stockCardOptions(card.id, undefined, true).queryKey, card);
  onlineManager.setOnline(false);
  renderRoute(path(), client);
  await screen.findByText('stock-card.offline-summary');
  let unreachableShown = false;
  const copy = new MutationObserver(() => {
    unreachableShown ||= !!document.body.textContent?.includes('stock-card.unreachable');
  });
  copy.observe(document.body, { childList: true, subtree: true, characterData: true });
  let finish!: (value: typeof card) => void;
  vi.mocked(fetchStockCard).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  expect(screen.getByText('stock-card.offline-summary')).toBeInTheDocument();
  await act(async () => finish({ ...card, stockOnHand: 99 }));
  expect(await screen.findByText('99')).toBeInTheDocument();
  copy.disconnect();
  expect(unreachableShown).toBe(false);
  expect(screen.queryByText('stock-card.offline-summary')).not.toBeInTheDocument();
  await waitFor(async () =>
    expect(await getLocalDb().table(LOCAL_TABLES.stockCardHistory).get(card.id)).toMatchObject({
      card: { stockOnHand: 99 },
    }),
  );
});
