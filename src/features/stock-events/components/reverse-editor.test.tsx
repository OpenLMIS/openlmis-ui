import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { reasonsOptions } from '@/features/reference-data/api/queries';
import { fetchEventStockOnHand } from '@/features/stock-events/api/api';
import {
  eventStockOnHandOptions,
  stockEventAllLinesOptions,
} from '@/features/stock-events/api/queries';
import { ReverseEditor } from '@/features/stock-events/components/reverse-editor';

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
function editor() {
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
    },
  ];
  client.setQueryData(stockEventAllLinesOptions('event').queryKey, lines);
  client.setQueryDefaults(stockEventAllLinesOptions('event').queryKey, { staleTime: Infinity });
  client.setQueryData(reasonsOptions().queryKey, []);
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
