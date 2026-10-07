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
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchStockCard, fetchStockCardReport } from '@/features/stock-card/api/api';
import type { StockCard } from '@/features/stock-card/lib/types';
import { openReport } from '@/lib/open-report';
import { Route } from '@/routes/(protected)/_protected.stock-management.stock-on-hand_.$stockCardId';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/stock-card/api/api', () => ({
  fetchStockCard: vi.fn(),
  fetchStockCardReport: vi.fn(),
}));
const deliver = vi.fn();
vi.mock('@/lib/open-report', () => ({ openReport: vi.fn(() => ({ deliver, close: vi.fn() })) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));

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

function renderRoute(location = path(), queryClient = appQueryClient()) {
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
  );
  return { router, queryClient, unmount: view.unmount };
}

beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: USER });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(grants);
  vi.mocked(fetchStockCard).mockResolvedValue(card);
});
afterEach(() => {
  useLoginData.setState({ referenceDataUserId: null });
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('stock card route', () => {
  it.each([true, false])('rechecks the card for a changed user, grant=%s', async (allowed) => {
    renderRoute();
    await screen.findByText('Vaccine - each');
    vi.mocked(fetchPermissionStrings).mockResolvedValue(allowed ? grants : []);
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, stockOnHand: 999 });
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    if (allowed) expect(await screen.findByText('999')).toBeInTheDocument();
    else
      expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(fetchPermissionStrings).toHaveBeenCalledWith('other');
    expect(fetchStockCard).toHaveBeenCalledTimes(2);
  });

  it('returns from Not Found with the same list search as the breadcrumb', async () => {
    vi.mocked(fetchStockCard).mockRejectedValue(httpError(404));
    renderRoute(path(`?facilityId=${HOME}&programId=${FP}&productCode=C1&page=7&cardPage=2`));
    const back = await screen.findByRole('button', { name: 'stock-card.back' });
    expect(back).toHaveAttribute(
      'href',
      screen
        .getByRole('link', {
          name: 'nav.stock-management.stock-on-hand',
        })
        .getAttribute('href'),
    );
  });

  it('opens an inactive card when the exact facility and program grant exists', async () => {
    renderRoute();
    expect(await screen.findByRole('heading', { name: 'stock-card.title' })).toBeInTheDocument();
    expect(await screen.findByText('Vaccine - each')).toBeInTheDocument();
    expect(fetchStockCard).toHaveBeenCalledWith('card1');
  });

  it('checks the card pair rather than the facility and program in the return search', async () => {
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, program: { ...card.program, id: EM } });
    renderRoute(path(`?facilityId=${HOME}&programId=${FP}&mode=my`));
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(screen.queryByText('Vaccine - each')).not.toBeInTheDocument();
  });

  it.each([
    { permissions: [] },
    { permissions: ['STOCK_CARDS_VIEW'] },
    { permissions: [`STOCK_CARDS_VIEW|another-facility|${FP}`] },
  ])('refuses missing or differently scoped grants: %j', async ({ permissions }) => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(permissions);
    renderRoute();
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
    expect(screen.queryByText('Vaccine - each')).not.toBeInTheDocument();
  });

  it.each([400, 404])('shows Not Found for status %i', async (status) => {
    vi.mocked(fetchStockCard).mockRejectedValue(httpError(status));
    renderRoute();
    expect(await screen.findByText('stock-card.not-found-title')).toBeInTheDocument();
  });

  it('shows No Access for a server refusal', async () => {
    vi.mocked(fetchStockCard).mockRejectedValue(httpError(403));
    renderRoute();
    expect(await screen.findByRole('heading', { name: 'no-access.title' })).toBeInTheDocument();
  });

  it('shows a load failure with retry for other server errors', async () => {
    vi.mocked(fetchStockCard).mockRejectedValue(httpError(500));
    renderRoute();
    expect(
      await screen.findByRole('heading', { name: 'stock-card.error-title' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'error.try-again' })).toBeInTheDocument();
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
    let release = () => {};
    vi.mocked(fetchStockCard).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(card);
      }),
    );
    const { router } = renderRoute();
    await waitFor(() => expect(fetchStockCard).toHaveBeenCalled());
    vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    await act(async () => release());
    await waitFor(() => expect(router.state.status).toBe('idle'));
    expect(screen.queryByText('Vaccine - each')).not.toBeInTheDocument();
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

  it('changes header and row quantities together when packs are chosen', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByText('Vaccine - each');
    await user.click(screen.getByRole('radio', { name: 'quantity-unit.packs' }));
    expect(screen.getAllByText('4 ( +3 )')).toHaveLength(3);
  });

  it('shows all eleven columns in legacy order on desktop and every field on mobile', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    width.mockReturnValue({ width: 1200 } as DOMRect);
    const first = renderRoute();
    const table = await screen.findByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      'stock-card.date',
      'stock-card.receive-from',
      'stock-card.issue-to',
      'stock-card.reason',
      'stock-card.adjustment',
      'stock-card.stock-on-hand',
      'stock-card.performed-by',
      'stock-card.signature',
      'stock-card.document-number',
      'stock-card.reversing',
      'stock-card.reversed-by',
    ]);
    first.unmount();
    width.mockReturnValue({ width: 390 } as DOMRect);
    renderRoute();
    await screen.findByText('Vaccine - each');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('term')).toHaveLength(11);
    expect(screen.queryByText('stock-card.reversed-by')).not.toBeInTheDocument();
    expect(screen.queryByText('stock-card.receive-from')).not.toBeInTheDocument();
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
    const queryClient = appQueryClient();
    const first = renderRoute(path(), queryClient);
    await screen.findByText('Vaccine - each');
    first.unmount();
    vi.mocked(fetchStockCard).mockRejectedValueOnce(httpError(500));
    renderRoute(path(), queryClient);
    await screen.findByRole('heading', { name: 'stock-card.error-title' });
    vi.mocked(fetchStockCard).mockResolvedValue({ ...card, stockOnHand: 999 });
    await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
    expect(await screen.findByText('999')).toBeInTheDocument();
    expect(fetchStockCard).toHaveBeenCalledTimes(3);
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
