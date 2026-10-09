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
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchReasons } from '@/features/reference-data/api/api';
import {
  cancelStockEvent,
  fetchAllStockEventLines,
  fetchEventStockOnHand,
  fetchStockEvent,
} from '@/features/stock-events/api/api';
import type { StockEventLine, StockEventSummary } from '@/features/stock-events/lib/types';
import { queryKeys } from '@/lib/key-factory';
import { Route } from '@/routes/(protected)/_protected.stock-management.transaction-history_.$eventId_.reverse';
import { httpError, networkError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/features/stock-events/api/api', () => ({
  fetchStockEvent: vi.fn(),
  fetchAllStockEventLines: vi.fn(),
  fetchEventStockOnHand: vi.fn(),
  cancelStockEvent: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchReasons: vi.fn(),
  fetchDeploymentTimeZone: vi.fn(async () => 'UTC'),
  storedTimeZone: vi.fn(() => null),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));
const event: StockEventSummary = {
  id: 'event1',
  facilityId: 'facility',
  programId: 'program',
  documentNumber: 'DOC-1',
  type: 'ISSUE',
  processedDate: '2026-10-08T14:35:00Z',
  username: 'recorder',
  signature: 'Signed',
  reversible: false,
};
const line: StockEventLine = {
  stockEventLineItemId: 'line1',
  orderable: { id: 'o1', productCode: 'C1', fullProductName: 'Vaccine', netContent: 5 },
  lot: { id: 'lot1', lotCode: 'LOT-A', expirationDate: null },
  destination: { name: 'Clinic' },
  occurredDate: '2026-10-01',
  quantity: 20,
  stockOnHand: 40,
};
const reason = {
  id: 'cancel',
  name: 'Cancelled issue',
  tags: ['cancelMovement'],
  reasonCategory: 'ADJUSTMENT' as const,
  reasonType: 'CREDIT' as const,
  isFreeTextAllowed: true,
};
function renderRoute(extra = '') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const group = createRoute({ getParentRoute: () => root, id: '(protected)' });
  const layout = createRoute({ getParentRoute: () => group, id: '_protected' });
  const page = createRoute({
    ...Route.options,
    getParentRoute: () => layout,
    path: 'stock-management/transaction-history/$eventId/reverse',
  } as never);
  const detail = createRoute({
    getParentRoute: () => layout,
    path: 'stock-management/transaction-history/$eventId',
    component: () => <p>Detail destination</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      group.addChildren([layout.addChildren([page, detail] as never)] as never),
    ] as never),
    context: { queryClient },
    history: createMemoryHistory({
      initialEntries: [`/stock-management/transaction-history/event1/reverse${extra}`],
    }),
  } as never) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
async function tick() {
  await screen.findByText('stock-event-reverse.title');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeEnabled(),
  );
  await userEvent.click((await screen.findAllByRole('checkbox'))[0]);
}
async function choose() {
  await userEvent.click(screen.getByRole('combobox', { name: 'stock-events.field-of' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Cancelled issue' }));
}
async function signing() {
  await tick();
  await choose();
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  const confirm = await screen.findByRole('dialog', { name: 'stock-event-reverse.confirm-title' });
  await userEvent.click(within(confirm).getByRole('button', { name: 'stock-events.confirm' }));
  return screen.findByRole('dialog', { name: 'stock-events.signature-title' });
}
beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: 'user1', username: 'user1' });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(['STOCK_EVENTS_CANCEL|elsewhere|other']);
  vi.mocked(fetchStockEvent).mockResolvedValue(event);
  vi.mocked(fetchAllStockEventLines).mockImplementation(async (id) =>
    id === 'new-event'
      ? [{ ...line, reason, reasonFreeText: 'Saved comment', stockOnHand: 80 }]
      : [line],
  );
  vi.mocked(fetchReasons).mockResolvedValue([reason]);
  vi.mocked(fetchEventStockOnHand).mockResolvedValue({ 'o1/lot1': 60 });
  vi.mocked(cancelStockEvent).mockResolvedValue('new-event');
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 2000,
  } as DOMRect);
});
afterEach(() => {
  useLoginData.setState({ referenceDataUserId: null });
  localStorage.clear();
  vi.restoreAllMocks();
});
describe('reverse transaction', () => {
  it('keeps the heading and toolbar visible while the lines load', async () => {
    vi.mocked(fetchAllStockEventLines).mockReturnValue(new Promise(() => {}));
    renderRoute();
    await screen.findByText('DOC-1');
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled();
  });
  it('requires the cancel right before loading lines', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
    renderRoute();
    await screen.findByRole('heading', { name: 'no-access.title' });
    expect(fetchAllStockEventLines).not.toHaveBeenCalled();
  });
  it('opens a non-reversible event with a right anywhere and omits signature', async () => {
    renderRoute();
    await screen.findByRole('heading', { name: 'stock-event-reverse.title' });
    await screen.findByText('Vaccine');
    expect(screen.queryByText('Signed')).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(14);
  });
  it('ticks with an empty reason and unticks without keeping a draft', async () => {
    renderRoute();
    await tick();
    expect(screen.getByRole('combobox', { name: 'stock-events.field-of' })).toHaveTextContent(
      'stock-event-reverse.select-option',
    );
    expect(screen.getByText('80')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(
      screen.queryByRole('combobox', { name: 'stock-events.field-of' }),
    ).not.toBeInTheDocument();
    await tick();
    expect(screen.getByRole('combobox', { name: 'stock-events.field-of' })).toHaveTextContent(
      'stock-event-reverse.select-option',
    );
  });
  it('reports an empty selection', async () => {
    renderRoute();
    await screen.findByText('Vaccine');
    await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
    await screen.findByText('stock-event-reverse.none-selected');
    expect(cancelStockEvent).not.toHaveBeenCalled();
  });
  it('sets both marks with the reason message first and keeps the stock mark after choosing', async () => {
    vi.mocked(fetchAllStockEventLines).mockResolvedValue([
      { ...line, destination: undefined, source: { name: 'Warehouse' } },
    ]);
    vi.mocked(fetchReasons).mockResolvedValue([{ ...reason, reasonType: 'DEBIT' }]);
    vi.mocked(fetchEventStockOnHand).mockResolvedValue({ 'o1/lot1': 0 });
    renderRoute();
    await tick();
    await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
    await screen.findByText('stock-events.required');
    expect(screen.getByText('stock-event-reverse.reason-required')).toBeInTheDocument();
    expect(screen.getByText('stock-event-reverse.negative-stock')).toBeInTheDocument();
    await choose();
    expect(screen.queryByText('stock-events.required')).not.toBeInTheDocument();
    expect(screen.getByText('stock-event-reverse.negative-stock')).toBeInTheDocument();
  });
  it('opens and focuses an invalid row on another page and flags that page', async () => {
    vi.mocked(fetchAllStockEventLines).mockResolvedValue(
      Array.from({ length: 11 }, (_, i) => ({
        ...line,
        stockEventLineItemId: `line${i}`,
        orderable: { ...line.orderable, fullProductName: `Product ${i}` },
      })),
    );
    const { router } = renderRoute('?reversePage=2');
    await tick();
    await act(() => router.navigate({ search: (() => ({})) as never }));
    await screen.findByText('Product 0');
    await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
    await screen.findByText('Product 10');
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'stock-events.field-of' })).toHaveFocus(),
    );
    expect(router.state.location.search.reversePage).toBe(2);
    expect(screen.getByRole('button', { name: /2.*invalid/i })).toBeInTheDocument();
  });
  it('keeps ticks when confirmation or signature is cancelled', async () => {
    renderRoute();
    await tick();
    await choose();
    await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
    let dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'stock-events.cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
    dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'stock-events.confirm' }));
    dialog = await screen.findByRole('dialog', { name: 'stock-events.signature-title' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'stock-events.cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
  });
  it('submits, reads the saved summary, invalidates and returns with search', async () => {
    const { router, queryClient } = renderRoute(
      '?page=3&detailPage=2&detailSize=20&documentNumber=DOC',
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const dialog = await signing();
    await userEvent.type(within(dialog).getByRole('textbox'), 'Signer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'stock-events.confirm' }));
    const summary = await screen.findByRole('dialog', {
      name: 'stock-event-reverse.summary-title',
    });
    expect(within(summary).getByText('Cancelled issue: Saved comment')).toBeInTheDocument();
    expect(cancelStockEvent).toHaveBeenCalledWith('event1', {
      signature: 'Signer',
      lineItems: [{ stockEventLineItemId: 'line1', reasonId: 'cancel' }],
    });
    for (const queryKey of [
      queryKeys.stockEvents.all,
      queryKeys.stockCards.all,
      queryKeys.stockCardSummaries.all,
    ])
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    await userEvent.click(
      within(summary).getByRole('button', { name: 'stock-event-reverse.close' }),
    );
    await screen.findByText('Detail destination');
    expect(router.state.location.search).toMatchObject({
      page: 3,
      detailPage: 2,
      detailSize: 20,
      documentNumber: 'DOC',
    });
    expect(toast.success).toHaveBeenCalledWith('stock-event-reverse.done-title', {
      description: 'stock-event-reverse.done-description',
    });
  });
  it('shows the failed summary read after saving', async () => {
    vi.mocked(fetchAllStockEventLines).mockImplementation(async (id) => {
      if (id === 'new-event') throw networkError();
      return [line];
    });
    renderRoute();
    const dialog = await signing();
    await userEvent.click(within(dialog).getByRole('button', { name: 'stock-events.confirm' }));
    await screen.findByText('stock-event-reverse.summary-unavailable');
  });
  it.each([httpError(500, { message: 'Server refuses' }), networkError()])(
    'shows a plain failure and keeps ticks for retry',
    async (error) => {
      vi.mocked(cancelStockEvent).mockRejectedValue(error);
      renderRoute();
      const dialog = await signing();
      await userEvent.click(within(dialog).getByRole('button', { name: 'stock-events.confirm' }));
      await screen.findByText(
        error.response ? 'Server refuses' : 'stock-event-reverse.failed-description',
      );
      expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeEnabled();
    },
  );
  it('puts line errors on the Reverse cell and clears them on reason change', async () => {
    vi.mocked(cancelStockEvent).mockRejectedValue(
      httpError(400, {
        lineErrors: [{ stockEventLineItemId: 'line1', message: 'Already reversed' }],
      }),
    );
    renderRoute();
    const dialog = await signing();
    await userEvent.click(within(dialog).getByRole('button', { name: 'stock-events.confirm' }));
    await screen.findByText('stock-event-reverse.line-errors');
    expect(within(screen.getAllByRole('row')[1]).getAllByRole('cell')[0]).toHaveTextContent(
      'Already reversed',
    );
    await choose();
    expect(screen.queryByText('Already reversed')).not.toBeInTheDocument();
  });
  it('ignores a user change during the summary read', async () => {
    let release = () => {};
    vi.mocked(fetchAllStockEventLines).mockImplementation((id) =>
      id === 'new-event'
        ? new Promise((resolve) => {
            release = () => resolve([line]);
          })
        : Promise.resolve([line]),
    );
    const { router } = renderRoute();
    const dialog = await signing();
    await userEvent.click(within(dialog).getByRole('button', { name: 'stock-events.confirm' }));
    await waitFor(() => expect(fetchAllStockEventLines).toHaveBeenCalledWith('new-event'));
    vi.mocked(fetchPermissionStrings).mockResolvedValue([]);
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    await act(async () => release());
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toContain('/reverse');
  });
  it('Cancel preserves detail search and asks before discarding ticks', async () => {
    const { router } = renderRoute('?page=4&detailPage=2');
    await tick();
    await userEvent.click(screen.getByRole('button', { name: 'stock-events.cancel' }));
    await screen.findByRole('alertdialog', { name: 'discard-changes.title' });
    expect(router.state.location.pathname).toContain('/reverse');
    await userEvent.click(screen.getByRole('button', { name: 'discard-changes.discard' }));
    await screen.findByText('Detail destination');
    expect(router.state.location.search).toMatchObject({ page: 4, detailPage: 2 });
    expect(cancelStockEvent).not.toHaveBeenCalled();
  });
  it('renders Reversed as plain text and disables its checkbox', async () => {
    vi.mocked(fetchAllStockEventLines).mockResolvedValue([
      { ...line, cancellationEventId: 'reversal', cancellationEventDocumentNumber: 'REV-1' },
    ]);
    renderRoute();
    await screen.findByText('REV-1');
    expect(screen.queryByRole('link', { name: 'REV-1' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-disabled', 'true');
  });
  it('falls back to the line balance when current stock fails', async () => {
    vi.mocked(fetchEventStockOnHand).mockRejectedValue(networkError());
    renderRoute();
    await tick();
    expect(screen.getByText('60')).toBeInTheDocument();
  });
  it('disables Submit with no lines', async () => {
    vi.mocked(fetchAllStockEventLines).mockResolvedValue([]);
    renderRoute();
    await screen.findByText('stock-event-reverse.no-lines');
    expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled();
  });
});
