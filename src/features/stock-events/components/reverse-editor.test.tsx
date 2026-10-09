import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { reasonsOptions } from '@/features/reference-data/api/queries';
import { cancelStockEvent, fetchEventStockOnHand } from '@/features/stock-events/api/api';
import {
  eventStockOnHandOptions,
  stockEventAllLinesOptions,
} from '@/features/stock-events/api/queries';
import { ReverseEditor } from '@/features/stock-events/components/reverse-editor';
import type {
  EventStockOnHand,
  StockEventLine,
  StockEventLineReason,
} from '@/features/stock-events/lib/types';

vi.mock('@/components/data-table/responsive-columns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/data-table/responsive-columns')>()),
  useElementWidth: () => [vi.fn(), 944],
}));
vi.mock('@/components/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
vi.mock('@/hooks/use-deployment-time-zone', () => ({ useDeploymentTimeZone: () => 'UTC' }));
vi.mock('@/hooks/use-discard-guard', () => ({
  useDiscardGuard: () => ({
    leaveIfAsked: () => false,
    dialog: { open: false, signingOut: false, onDiscard: vi.fn(), onKeepEditing: vi.fn() },
  }),
}));
vi.mock('@/features/stock-events/api/api', () => ({
  fetchAllStockEventLines: vi.fn(),
  fetchEventStockOnHand: vi.fn(),
  cancelStockEvent: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({ fetchReasons: vi.fn() }));
beforeEach(() => {
  useLoginData.setState({ referenceDataUserId: 'user' });
  vi.mocked(fetchEventStockOnHand).mockResolvedValue({});
});
const reason: StockEventLineReason = {
  id: 'reason',
  name: 'Cancelled issue',
  reasonCategory: 'ADJUSTMENT',
  reasonType: 'CREDIT',
  tags: ['cancelMovement'],
  isFreeTextAllowed: true,
};
function editor(overrides: Partial<StockEventLine> = {}, seedCurrent = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const lines = [
    {
      stockEventLineItemId: 'line',
      orderable: { id: 'o', productCode: 'C1', fullProductName: 'Vaccine', netContent: 5 },
      destination: { name: 'Clinic' },
      lot: null,
      quantity: 20,
      stockOnHand: 30,
      occurredDate: '2026-10-01',
      ...overrides,
    },
  ];
  client.setQueryData(stockEventAllLinesOptions('event').queryKey, lines);
  client.setQueryDefaults(stockEventAllLinesOptions('event').queryKey, { staleTime: Infinity });
  client.setQueryData(reasonsOptions().queryKey, [
    reason,
    { ...reason, id: 'no-text', name: 'No Text', isFreeTextAllowed: false },
    { ...reason, id: 'other', name: 'Other reason' },
    { ...reason, id: 'debit', reasonType: 'DEBIT', name: 'Cancelled receipt' },
    { ...reason, id: 'debit-other', reasonType: 'DEBIT', name: 'Other receipt reason' },
  ]);
  if (seedCurrent)
    client.setQueryData(
      eventStockOnHandOptions({ facilityId: 'facility', programId: 'program', orderableIds: ['o'] })
        .queryKey,
      {},
    );
  render(
    <QueryClientProvider client={client}>
      <ReverseEditor
        event={{
          id: 'event',
          facilityId: 'facility',
          programId: 'program',
          type: 'ISSUE',
          documentNumber: 'D',
          reversible: true,
        }}
        username="user"
        search={{ reversePage: undefined, reverseSize: undefined }}
        onSearchChange={vi.fn()}
        onSubmitted={vi.fn()}
        cancel={<button type="button">Cancel</button>}
      >
        Header
      </ReverseEditor>
    </QueryClientProvider>,
  );
  return client;
}
it('cannot submit without selecting a row', async () => {
  editor();
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(screen.getByText('stock-event-reverse.none-selected')).toBeInTheDocument();
});
it('does not auto-pick a cancellation reason when ticking', async () => {
  editor();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeEnabled(),
  );
  await userEvent.click(screen.getAllByRole('checkbox')[0]);
  expect(screen.getByRole('combobox', { name: 'stock-events.field-of' })).toHaveTextContent(
    'stock-event-reverse.select-option',
  );
});

async function tick() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeEnabled(),
  );
  await userEvent.click(screen.getAllByRole('checkbox')[0]);
}
async function pick(name = 'Cancelled issue') {
  await userEvent.click(screen.getByRole('combobox', { name: 'stock-events.field-of' }));
  await userEvent.click(screen.getByRole('option', { name }));
}
it('shows validation as the alert title and dismisses it on ticking', async () => {
  editor();
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(screen.queryByText('stock-event-reverse.failed-title')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('stock-event-reverse.none-selected');
  await tick();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('dismisses missing-reason validation on unticking', async () => {
  editor();
  await tick();
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(screen.getByText('stock-event-reverse.reason-required')).toBeInTheDocument();
  await tick();
  expect(screen.queryByText('stock-event-reverse.reason-required')).not.toBeInTheDocument();
});
it('clears the reason mark and validation alert when a reason is chosen', async () => {
  editor();
  await tick();
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(screen.getByRole('combobox', { name: 'stock-events.field-of' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await pick();
  expect(screen.queryByText('stock-event-reverse.reason-required')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'stock-events.field-of' })).not.toHaveAttribute(
    'aria-invalid',
    'true',
  );
});
it('dismisses the alert on reason change but keeps the stock mark until Submit', async () => {
  const client = editor({ destination: null, source: { name: 'Depot' }, quantity: 40 });
  await tick();
  await pick('Cancelled receipt');
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(screen.getAllByText('stock-event-reverse.negative-stock')).toHaveLength(2);
  await pick('Other receipt reason');
  expect(screen.getAllByText('stock-event-reverse.negative-stock')).toHaveLength(1);
  client.setQueryData(
    eventStockOnHandOptions({ facilityId: 'facility', programId: 'program', orderableIds: ['o'] })
      .queryKey,
    { 'o/': 80 },
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeEnabled(),
  );
  expect(screen.getByText('stock-event-reverse.negative-stock')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(screen.queryByText('stock-event-reverse.negative-stock')).not.toBeInTheDocument();
});
it.each([
  new Error('No response'),
  { isAxiosError: true, response: { status: 400, data: { message: 'Server refused reversal' } } },
  {
    isAxiosError: true,
    response: {
      status: 400,
      data: { lineErrors: [{ stockEventLineItemId: 'line', message: 'Line refused' }] },
    },
  },
])('keeps server failure after edits and clears it on the next Submit: %j', async (error) => {
  vi.mocked(cancelStockEvent).mockRejectedValueOnce(error);
  editor();
  await tick();
  await pick();
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.confirm' }));
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.confirm' }));
  await screen.findByText('stock-event-reverse.failed-title');
  await pick('Other reason');
  expect(screen.getByText('stock-event-reverse.failed-title')).toBeInTheDocument();
  await tick();
  expect(screen.getByText('stock-event-reverse.failed-title')).toBeInTheDocument();
  await tick();
  expect(screen.getByText('stock-event-reverse.failed-title')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(screen.queryByText('stock-event-reverse.failed-title')).not.toBeInTheDocument();
});

it('dismisses the comments validation alert on reason change', async () => {
  editor();
  await tick();
  await pick();
  fireEvent.change(screen.getByRole('textbox', { name: 'stock-events.field-of' }), {
    target: { value: 'x'.repeat(256) },
  });
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(screen.getAllByText('stock-events.comments-too-long')).toHaveLength(2);
  await pick('Other reason');
  expect(screen.getAllByText('stock-events.comments-too-long')).toHaveLength(1);
  expect(screen.queryByText('stock-event-reverse.failed-title')).not.toBeInTheDocument();
});

it('shows every reverse column at laptop content width with the sidebar open', () => {
  editor();
  expect(screen.getAllByRole('columnheader')).toHaveLength(14);
});

it('keeps the same comments textarea focused while typing several characters', async () => {
  editor();
  await tick();
  await pick();
  const textarea = screen.getByRole('textbox', { name: 'stock-events.field-of' });
  await userEvent.click(textarea);
  await userEvent.keyboard('hello');
  expect(textarea).toHaveValue('hello');
  expect(textarea).toHaveFocus();
  expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toBe(textarea);
});
it('keeps keyboard focus when toggling Reverse with Space', async () => {
  editor();
  await waitFor(() => expect(screen.getAllByRole('checkbox')[0]).toBeEnabled());
  const checkbox = screen.getAllByRole('checkbox')[0];
  checkbox.focus();
  await userEvent.keyboard(' ');
  expect(checkbox).toBeChecked();
  expect(checkbox).toHaveFocus();
});
it('returns focus to the same reason trigger after a keyboard selection', async () => {
  editor();
  await tick();
  const trigger = screen.getByRole('combobox', { name: 'stock-events.field-of' });
  trigger.focus();
  await userEvent.keyboard('{ArrowDown}');
  await screen.findByRole('option', { name: 'Cancelled issue' });
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(trigger).toHaveTextContent('Cancelled issue');
});
it('links comments and stock validation marks to their controls', async () => {
  editor({ destination: null, source: { name: 'Depot' }, quantity: 40 });
  await tick();
  await pick('Cancelled receipt');
  const comments = screen.getByRole('textbox', { name: 'stock-events.field-of' });
  fireEvent.change(comments, { target: { value: 'x'.repeat(256) } });
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  const description = screen
    .getByRole('textbox', { name: 'stock-events.field-of' })
    .getAttribute('aria-describedby');
  expect(document.getElementById(description ?? '')).toHaveTextContent(
    'stock-events.comments-too-long',
  );
  const balance = document.getElementById('balance-line');
  expect(balance).toHaveAttribute('aria-invalid', 'true');
  expect(
    document.getElementById(balance?.getAttribute('aria-describedby') ?? ''),
  ).toHaveTextContent('stock-event-reverse.negative-stock');
});
it('links a server line error and focuses its Reverse checkbox', async () => {
  vi.mocked(cancelStockEvent).mockRejectedValueOnce({
    isAxiosError: true,
    response: {
      status: 400,
      data: { lineErrors: [{ stockEventLineItemId: 'line', message: 'Line refused' }] },
    },
  });
  editor();
  await tick();
  await pick();
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.confirm' }));
  await userEvent.click(screen.getByRole('button', { name: 'stock-events.confirm' }));
  expect(await screen.findByText('Line refused')).toBeVisible();
  const checkbox = screen.getAllByRole('checkbox')[0];
  expect(
    document.getElementById(checkbox.getAttribute('aria-describedby') ?? ''),
  ).toHaveTextContent('Line refused');
  await waitFor(() => expect(checkbox).toHaveFocus());
});

it('drops comments when the new reason disallows them', async () => {
  editor();
  await tick();
  await pick();
  await userEvent.type(screen.getByRole('textbox', { name: 'stock-events.field-of' }), 'Mistake');
  await pick('No Text');
  expect(screen.queryByRole('textbox', { name: 'stock-events.field-of' })).not.toBeInTheDocument();
  await pick();
  expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveValue('');
});

it('hides historical stock until the current stock request settles', async () => {
  let resolveStock!: (stock: EventStockOnHand) => void;
  vi.mocked(fetchEventStockOnHand).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveStock = resolve;
    }),
  );
  editor({}, false);
  await waitFor(() => expect(fetchEventStockOnHand).toHaveBeenCalled());
  const row = screen.getByText('Vaccine').closest('tr');
  if (!row) throw new Error('Missing product row');
  const current = within(row).getAllByRole('cell')[9];
  expect(current.textContent).toBe('');
  expect(current.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  expect(within(row).queryByText('30')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled();
  await act(async () => resolveStock({ 'o/': 0 }));
  await waitFor(() => expect(current).toHaveTextContent('0'));
  expect(current.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument();
  await tick();
  expect(document.getElementById('balance-line')).toHaveTextContent('20');
});

it('hides selected balances while refreshing current stock', async () => {
  const client = editor();
  await tick();
  let resolveStock!: (stock: EventStockOnHand) => void;
  vi.mocked(fetchEventStockOnHand).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveStock = resolve;
    }),
  );
  act(() => {
    void client.invalidateQueries({
      queryKey: eventStockOnHandOptions({
        facilityId: 'facility',
        programId: 'program',
        orderableIds: ['o'],
      }).queryKey,
    });
  });
  const balance = document.getElementById('balance-line');
  if (!balance) throw new Error('Missing balance cell');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled(),
  );
  expect(balance.textContent).toBe('');
  expect(balance.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  await act(async () => resolveStock({ 'o/': 0 }));
  await waitFor(() => expect(balance).toHaveTextContent('20'));
});
