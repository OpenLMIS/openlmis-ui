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
import { formatTimestamp } from '@/components/form/date-value';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchStockEvent,
  fetchStockEventLines,
  fetchStockEventReport,
} from '@/features/stock-events/api/api';
import type { StockEventLine, StockEventSummary } from '@/features/stock-events/lib/types';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { openReport } from '@/lib/open-report';
import { Route } from '@/routes/(protected)/_protected.stock-management.transaction-history_.$eventId';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/stock-events/api/api', () => ({
  fetchStockEvent: vi.fn(),
  fetchStockEventLines: vi.fn(),
  fetchStockEventReport: vi.fn(),
}));
const deliver = vi.fn();
vi.mock('@/lib/open-report', () => ({ openReport: vi.fn(() => ({ deliver, close: vi.fn() })) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchDeploymentTimeZone: vi.fn(async () => 'Pacific/Auckland'),
}));

const USER = 'user1';
const HOME = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const FP = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';
const EM = '10845cb9-d365-4aaa-badd-b4fa39c6a26a';
const event: StockEventSummary = {
  id: 'event1',
  facilityId: HOME,
  programId: FP,
  documentNumber: 'DOC-1',
  type: 'ISSUE',
  processedDate: '2026-10-08T14:35:00Z',
  username: 'recorder',
  signature: 'Signed',
  reversible: true,
};
const line: StockEventLine = {
  stockEventLineItemId: 'line1',
  orderable: {
    id: 'o1',
    productCode: 'C1',
    fullProductName: 'Vaccine',
    netContent: 5,
    dispensable: { displayUnit: 'each' },
  },
  lot: { id: 'lot1', lotCode: 'LOT-A', expirationDate: '2027-01-31' },
  source: { name: 'Warehouse' },
  sourceFreeText: 'North',
  destination: { name: 'Clinic' },
  destinationFreeText: 'South',
  reason: { name: 'Count', reasonType: 'CREDIT', reasonCategory: 'PHYSICAL_INVENTORY' },
  occurredDate: '2026-10-01',
  quantity: 23,
  stockOnHand: 41,
  reversedEventId: 'original',
  cancellationEventId: 'reversal',
  cancellationEventDocumentNumber: 'REV-1',
};
const linesPage = (content = [line], totalElements = 1) => ({
  content,
  totalElements,
  totalPages: Math.ceil(totalElements / 10),
  number: 0,
  size: 10,
  last: true,
  first: true,
  numberOfElements: content.length,
});
const grants = [`STOCK_CARDS_VIEW|${HOME}|${FP}`];
const appQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  });
const path = (extra = '') => `/stock-management/transaction-history/event1${extra}`;

function renderRoute(location = path(), queryClient = appQueryClient()) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const page = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/transaction-history/$eventId',
    validateSearch: Route.options.validateSearch as never,
    loader: Route.options.loader as never,
    loaderDeps: Route.options.loaderDeps as never,
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
  return { router, queryClient, unmount: view.unmount, container: view.container };
}

beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: USER });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(grants);
  vi.mocked(fetchStockEvent).mockResolvedValue(event);
  vi.mocked(fetchStockEventLines).mockResolvedValue(linesPage());
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1400,
  } as DOMRect);
});
afterEach(() => {
  useLoginData.setState({ referenceDataUserId: null });
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('stock event detail', () => {
  it.each(['ISSUE', 'RECEIVE', 'ADJUSTMENT'] as const)(
    'shows header fields and processed date with time for %s',
    async (type) => {
      vi.mocked(fetchStockEvent).mockResolvedValue({ ...event, type });
      renderRoute();
      await screen.findByRole('heading', { name: 'stock-event.title' });
      const header = screen.getByRole('region', { name: 'stock-event.document-number DOC-1' });
      expect(
        within(header)
          .getAllByRole('term')
          .map((term) => term.textContent),
      ).toEqual([
        'stock-event.type',
        'stock-event.date',
        'stock-event.performed-by',
        'stock-event.signature',
      ]);
      expect(
        within(header).getByText(`transaction-history.type-${type.toLowerCase()}`),
      ).toBeInTheDocument();
      expect(
        within(header).getByText(
          formatTimestamp(event.processedDate, 'en', { time: true, timeZone: 'Pacific/Auckland' }),
        ),
      ).toBeInTheDocument();
      expect(within(header).getByText('recorder')).toBeInTheDocument();
      expect(within(header).getByText('Signed')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reverse/i })).not.toBeInTheDocument();
    },
  );

  it('announces no empty Document Number heading while the event loads', async () => {
    vi.mocked(fetchStockEvent).mockReturnValue(new Promise(() => {}));
    const { container } = renderRoute();

    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(screen.queryByRole('heading', { name: /stock-event.document-number/ })).toBeNull();
  });

  it('omits the document strip and renders placeholders for old events', async () => {
    vi.mocked(fetchStockEvent).mockResolvedValue({
      ...event,
      documentNumber: null,
      type: null,
      signature: null,
    });
    renderRoute();
    await screen.findByRole('heading', { name: 'stock-event.title' });
    expect(screen.queryByText('stock-event.document-number')).not.toBeInTheDocument();
    expect(screen.queryByText('DOC-1')).not.toBeInTheDocument();
    expect(screen.getAllByText(EMPTY_VALUE).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps where stock came from and went to on a laptop, dropping the expiry date first', async () => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
      width: 960,
    } as DOMRect);
    renderRoute();
    const table = await screen.findByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toContain('stock-event.source');
    expect(headers).toContain('stock-event.destination');
    expect(headers).toContain('stock-event.reason');
    expect(headers).not.toContain('stock-event.expiry-date');
  });

  it('shows line columns in legacy order and labels with free text', async () => {
    renderRoute();
    const table = await screen.findByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      'stock-event.product',
      'stock-event.lot-code',
      'stock-event.expiry-date',
      'stock-event.source',
      'stock-event.destination',
      'stock-event.line-date',
      'stock-event.quantity',
      'stock-event.reason',
      'stock-event.stock-on-hand',
      'stock-event.reversing',
      'stock-event.reversed-by',
    ]);
    expect(within(table).getByText('Vaccine (C1)')).toBeInTheDocument();
    expect(within(table).getByText('Warehouse: North')).toBeInTheDocument();
    expect(within(table).getByText('Clinic: South')).toBeInTheDocument();
    expect(within(table).getByText('Count')).toBeInTheDocument();
    expect(within(table).getByText('Jan 31, 2027')).toBeInTheDocument();
  });

  it('leaves the reversal columns out until a line on the page has a reversal', async () => {
    vi.mocked(fetchStockEventLines).mockResolvedValue(
      linesPage([{ ...line, reversedEventId: null, cancellationEventId: null }]),
    );
    renderRoute();
    const table = await screen.findByRole('table');
    await within(table).findByText('Vaccine (C1)');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).not.toContain('stock-event.reversing');
    expect(headers).not.toContain('stock-event.reversed-by');
  });

  it('shows No Lot Defined, empty expiry, and a reason with free text', async () => {
    vi.mocked(fetchStockEventLines).mockResolvedValue(
      linesPage([{ ...line, lot: null, reasonFreeText: 'Recount' }]),
    );
    renderRoute();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('stock-event.no-lot')).toBeInTheDocument();
    expect(within(table).getByText('Count: Recount')).toBeInTheDocument();
    expect(within(table).getByText(EMPTY_VALUE)).toBeInTheDocument();
  });

  it('pages on the server independently from list paging and keeps the header', async () => {
    vi.mocked(fetchStockEventLines).mockResolvedValue(linesPage([line], 25));
    const { router } = renderRoute(path('?detailPage=2&page=7&size=20'));
    await screen.findByRole('table');
    expect(fetchStockEventLines).toHaveBeenCalledWith('event1', { page: 1, size: 10 });
    await userEvent.click(screen.getByRole('button', { name: 'Next Page' }));
    await waitFor(() =>
      expect(fetchStockEventLines).toHaveBeenCalledWith('event1', { page: 2, size: 10 }),
    );
    expect(router.state.location.search).toMatchObject({ detailPage: 3, page: 7, size: 20 });
    expect(fetchStockEvent).toHaveBeenCalledTimes(1);
  });

  it('clamps past the end while preserving list filters', async () => {
    vi.mocked(fetchStockEventLines).mockImplementation(async (_, query) =>
      linesPage(query.page > 2 ? [] : [line], 25),
    );
    const { router } = renderRoute(path('?detailPage=99&page=7&documentNumber=DOC'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        detailPage: 3,
        page: 7,
        documentNumber: 'DOC',
      }),
    );
    expect(fetchStockEventLines).toHaveBeenCalledWith('event1', { page: 2, size: 10 });
    expect(fetchStockEvent).toHaveBeenCalledTimes(1);
  });

  it('keeps the header while lines are loading and disables Print', async () => {
    vi.mocked(fetchStockEventLines).mockReturnValue(new Promise(() => {}));
    renderRoute();
    await screen.findByText('DOC-1');
    expect(screen.getByRole('button', { name: 'stock-event.print' })).toBeDisabled();
  });

  it('converts both quantities to packs with remainders', async () => {
    renderRoute();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('radio', { name: 'quantity-unit.packs' }));
    expect(screen.getByText('4 ( +3 )')).toBeInTheDocument();
    expect(screen.getByText('8 ( +1 )')).toBeInTheDocument();
  });

  it('shows empty lines, disables Print and clamps to the first page', async () => {
    vi.mocked(fetchStockEventLines).mockResolvedValue(linesPage([], 0));
    const { router } = renderRoute(path('?detailPage=99'));
    await screen.findByText('stock-event.no-lines-title');
    expect(screen.getByRole('button', { name: 'stock-event.print' })).toBeDisabled();
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('detailPage'));
  });

  it('retries a lines failure inside its boundary while keeping the header', async () => {
    vi.mocked(fetchStockEventLines).mockRejectedValue(httpError(500));
    renderRoute();
    await screen.findByText('stock-event.lines-error-title');
    expect(screen.getByText('DOC-1')).toBeInTheDocument();
    vi.mocked(fetchStockEventLines).mockResolvedValue(linesPage());
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await screen.findByText('Vaccine (C1)');
  });

  it('prints using the selected unit and language and opens the report', async () => {
    const pdf = new Blob(['%PDF']);
    vi.mocked(fetchStockEventReport).mockResolvedValue(pdf);
    renderRoute();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('radio', { name: 'quantity-unit.packs' }));
    await userEvent.click(screen.getByRole('button', { name: 'stock-event.print' }));
    await waitFor(() =>
      expect(fetchStockEventReport).toHaveBeenCalledWith('event1', {
        showInDoses: false,
        lang: 'en',
      }),
    );
    expect(openReport).toHaveBeenCalledWith('stock_event_event1.pdf', 'stock-event.print-loading');
    expect(deliver).toHaveBeenCalledWith(pdf);
  });

  it.each([400, 404])('shows Not Found with the return list search for %s', async (status) => {
    vi.mocked(fetchStockEvent).mockRejectedValue(httpError(status));
    renderRoute(path(`?facilityId=${HOME}&programId=${FP}&type=issue&page=7&detailPage=2`));
    const back = await screen.findByRole('button', { name: 'stock-event.back' });
    const url = new URL((back as HTMLAnchorElement).href);
    expect(url.pathname).toBe('/stock-management/transaction-history');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      facilityId: HOME,
      programId: FP,
      type: 'issue',
      page: '7',
    });
  });

  it.each([
    { permissions: [] },
    { permissions: ['STOCK_CARDS_VIEW'] },
    { permissions: [`STOCK_CARDS_VIEW|other|${FP}`] },
    { permissions: [`STOCK_CARDS_VIEW|${HOME}|${EM}`] },
  ])('refuses an inexact grant %j', async ({ permissions }) => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(permissions);
    renderRoute();
    await screen.findByRole('heading', { name: 'no-access.title' });
    expect(fetchStockEventLines).not.toHaveBeenCalled();
    expect(screen.queryByText('DOC-1')).not.toBeInTheDocument();
  });

  it('checks the event pair instead of the pair in return search', async () => {
    vi.mocked(fetchStockEvent).mockResolvedValue({ ...event, programId: EM });
    renderRoute(path(`?facilityId=${HOME}&programId=${FP}`));
    await screen.findByRole('heading', { name: 'no-access.title' });
  });

  it('shows No Access for a server 403', async () => {
    vi.mocked(fetchStockEvent).mockRejectedValue(httpError(403));
    renderRoute();
    await screen.findByRole('heading', { name: 'no-access.title' });
  });

  it.each([true, false])('reloads for a changed user with access=%s', async (allowed) => {
    renderRoute();
    await screen.findByText('DOC-1');
    vi.mocked(fetchPermissionStrings).mockResolvedValue(allowed ? grants : []);
    vi.mocked(fetchStockEvent).mockResolvedValue({ ...event, documentNumber: 'NEW-DOC' });
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    if (allowed) await screen.findByText('NEW-DOC');
    else await screen.findByRole('heading', { name: 'no-access.title' });
    expect(fetchPermissionStrings).toHaveBeenCalledWith('other');
    expect(fetchStockEvent).toHaveBeenCalledTimes(2);
  });

  it('preserves list search and resets detail paging in reversal links', async () => {
    localStorage.setItem(
      'stock-event.column-visibility',
      JSON.stringify({ reversing: true, reversedBy: true }),
    );
    vi.mocked(fetchStockEventLines).mockResolvedValue(linesPage([line], 50));
    renderRoute(path('?detailPage=3&detailSize=20&page=7&type=issue&documentNumber=DOC'));
    const reversing = await screen.findByRole('link', { name: 'stock-event.view-event' });
    const reversedBy = screen.getByRole('link', { name: 'REV-1' });
    for (const [link, target] of [
      [reversing, 'original'],
      [reversedBy, 'reversal'],
    ] as const) {
      const url = new URL((link as HTMLAnchorElement).href);
      expect(url.pathname).toBe(`/stock-management/transaction-history/${target}`);
      expect(Object.fromEntries(url.searchParams)).toEqual({
        page: '7',
        type: 'issue',
        documentNumber: 'DOC',
      });
    }
  });

  it('keeps the rendered breadcrumb linked to the filtered list', async () => {
    renderRoute(
      path(
        `?mode=supervised&facilityId=${HOME}&programId=${FP}&type=issue&startDate=2026-10-01&endDate=2026-10-08&documentNumber=DOC&page=7&size=20&detailPage=2`,
      ),
    );
    await screen.findByText('DOC-1');
    const link = screen.getByRole('link', { name: 'nav.stock-management.transaction-history' });
    const url = new URL((link as HTMLAnchorElement).href);
    expect(url.pathname).toBe('/stock-management/transaction-history');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      mode: 'supervised',
      facilityId: HOME,
      programId: FP,
      type: 'issue',
      startDate: '2026-10-01',
      endDate: '2026-10-08',
      documentNumber: 'DOC',
      page: '7',
      size: '20',
    });
  });

  it('keeps current rows dimmed during deferred line paging', async () => {
    vi.mocked(fetchStockEventLines).mockResolvedValue(linesPage([line], 25));
    const { router } = renderRoute();
    await screen.findByText('Vaccine (C1)');
    let release = () => {};
    vi.mocked(fetchStockEventLines).mockReturnValueOnce(
      new Promise((resolve) => {
        release = () =>
          resolve(
            linesPage(
              [{ ...line, orderable: { ...line.orderable, fullProductName: 'Other Product' } }],
              25,
            ),
          );
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next Page' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ detailPage: 2 }));
    expect(screen.getByText('Vaccine (C1)')).toBeInTheDocument();
    expect(screen.getByRole('table').closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('DOC-1')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'stock-event.reversed-by' }),
    ).toBeInTheDocument();
    await act(async () => release());
    await screen.findByText('Other Product (C1)');
  });

  it('shows only the reversal column the page has values for', async () => {
    vi.mocked(fetchStockEventLines).mockResolvedValue(
      linesPage([{ ...line, reversedEventId: null }]),
    );
    renderRoute();
    const table = await screen.findByRole('table');
    await within(table).findByText('Vaccine (C1)');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toContain('stock-event.reversed-by');
    expect(headers).not.toContain('stock-event.reversing');
  });

  it('drops the reversal columns on a phone, keeping stock on hand', async () => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
      width: 390,
    } as DOMRect);
    renderRoute();
    const table = await screen.findByRole('table');
    await within(table).findByText('Vaccine (C1)');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['stock-event.product', 'stock-event.quantity']);
  });

  it('fetches the header fresh on each entry even when cached', async () => {
    const queryClient = appQueryClient();
    const first = renderRoute(path(), queryClient);
    await screen.findByText('DOC-1');
    first.unmount();
    vi.mocked(fetchStockEvent).mockResolvedValue({ ...event, documentNumber: 'FRESH-DOC' });
    renderRoute(path(), queryClient);
    await screen.findByText('FRESH-DOC');
    expect(fetchStockEvent).toHaveBeenCalledTimes(2);
  });

  it('reads each event fresh when moving between events and back', async () => {
    vi.mocked(fetchStockEvent).mockImplementation(async (id) => ({
      ...event,
      id,
      documentNumber: id === 'event1' ? 'DOC-1' : 'DOC-2',
    }));
    const { router } = renderRoute();
    await screen.findByText('DOC-1');
    await act(() =>
      router.navigate({
        to: '/stock-management/transaction-history/$eventId',
        params: { eventId: 'event2' },
      }),
    );
    await screen.findByText('DOC-2');
    vi.mocked(fetchStockEvent).mockResolvedValue({ ...event, documentNumber: 'DOC-1-NEW' });
    await act(() => router.history.back());
    await screen.findByText('DOC-1-NEW');
    expect(fetchStockEvent).toHaveBeenCalledTimes(3);
  });

  it('reads an event fresh on the way back from one that failed to load', async () => {
    vi.mocked(fetchStockEvent).mockImplementation(async (id) => {
      if (id === 'missing') throw httpError(404);
      return { ...event, id };
    });
    const { router } = renderRoute();
    await screen.findByText('DOC-1');
    await act(() =>
      router.navigate({
        to: '/stock-management/transaction-history/$eventId',
        params: { eventId: 'missing' },
      }),
    );
    await screen.findByText('stock-event.not-found-title');
    vi.mocked(fetchStockEvent).mockResolvedValue({ ...event, documentNumber: 'DOC-1-NEW' });
    await act(() => router.history.back());
    await screen.findByText('DOC-1-NEW');
  });

  it('does not reveal a late event after a user change', async () => {
    let release = () => {};
    vi.mocked(fetchStockEvent).mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve(event);
      }),
    );
    renderRoute();
    await waitFor(() => expect(fetchStockEvent).toHaveBeenCalled());
    vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    await act(async () => release());
    await screen.findByRole('heading', { name: 'no-access.title' });
    expect(screen.queryByText('DOC-1')).not.toBeInTheDocument();
    expect(fetchStockEventLines).not.toHaveBeenCalled();
  });

  it('returns canReverse from the loader without showing a Reverse action', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([
      ...grants,
      `STOCK_EVENTS_CANCEL|${HOME}|${FP}`,
    ]);
    const { router } = renderRoute();
    await screen.findByText('DOC-1');
    expect(router.state.matches.at(-1)?.loaderData).toMatchObject({ canReverse: true });
    expect(screen.queryByRole('button', { name: /reverse/i })).not.toBeInTheDocument();
  });

  it('returns validated list search from the breadcrumb callback', () => {
    expect(
      Route.options.staticData?.crumbParentSearch?.({
        detailPage: 3,
        detailSize: 20,
        page: 7,
        type: 'issue',
        documentNumber: 'DOC',
        facilityId: HOME,
        programId: FP,
      }),
    ).toMatchObject({
      page: 7,
      type: 'issue',
      documentNumber: 'DOC',
      facilityId: HOME,
      programId: FP,
    });
    expect(Route.options.staticData?.crumbParentSearch?.({ detailPage: 3 })).not.toHaveProperty(
      'detailPage',
    );
  });
});
