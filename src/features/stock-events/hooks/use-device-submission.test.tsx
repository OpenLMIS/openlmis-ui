import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import { useDeviceSubmission } from '@/features/stock-events/hooks/use-device-submission';
import type { EventForm } from '@/features/stock-events/hooks/use-event-form';
import type { StockEvent } from '@/features/stock-events/lib/types';

const { submit } = vi.hoisted(() => ({
  submit: vi.fn(async () => ({ localEventId: 'event' })),
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/features/stock-events/hooks/use-stock-event-autosave', () => ({
  useStockEventAutosave: () => ({ submit }),
}));
vi.mock('@/features/stock-events/lib/stock-event-delivery', () => ({
  waitForStockEventReceipt: async () => ({ kind: 'queued' }),
}));

it.each([
  { name: 'typed new lot', lot: { lotCode: 'NEW-1' }, expected: [] },
  { name: 'no lot', expected: [{ id: 'no-lot-card', orderableId: 'product' }] },
  {
    name: 'existing lot',
    lotId: 'lot',
    expected: [{ id: 'lot-card', orderableId: 'product', lotId: 'lot' }],
  },
])('retains only valid Stock Card review links for a $name receipt', async (entry) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, networkMode: 'always' } },
  });
  const stockOptions = eventStockCardsOptions({ facilityId: 'facility', programId: 'program' });
  queryClient.setQueryData(stockOptions.queryKey, {
    device: undefined,
    cards: [
      {
        id: 'no-lot-card',
        lot: null,
        stockOnHand: 10,
        orderable: { id: 'product', productCode: 'MED', fullProductName: 'Medicine' },
      },
      {
        id: 'lot-card',
        stockOnHand: 10,
        orderable: { id: 'product', productCode: 'MED', fullProductName: 'Medicine' },
        lot: { id: 'lot', lotCode: 'LOT-1', expirationDate: null },
      },
      {
        id: 'other-card',
        lot: null,
        stockOnHand: 10,
        orderable: { id: 'other', productCode: 'OTHER', fullProductName: 'Other' },
      },
    ],
  });
  const { result, unmount } = renderHook(
    () =>
      useDeviceSubmission({
        kind: 'receive',
        facilityId: 'facility',
        programId: 'program',
        canViewStock: true,
        form: {} as EventForm,
        cards: undefined,
        today: '2026-10-23',
        stockOptions,
        deviceDisplay: {
          facility: { id: 'facility', code: 'HOME', name: 'Clinic' },
          program: { id: 'program', code: 'MED', name: 'Medicines' },
        },
        reasons: [],
        assignments: [],
      }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    },
  );
  const body: StockEvent = {
    facilityId: 'facility',
    programId: 'program',
    signature: 'Fixture User',
    lineItems: [
      {
        orderableId: 'product',
        quantity: 5,
        occurredDate: '2026-10-23',
        ...('lot' in entry ? { lot: entry.lot } : {}),
        ...('lotId' in entry ? { lotId: entry.lotId } : {}),
      },
    ],
  };
  await act(async () => {
    await result.current.mutation.mutateAsync(body);
  });
  expect(submit).toHaveBeenLastCalledWith(
    body,
    expect.objectContaining({ stockCards: entry.expected }),
    expect.any(Object),
  );
  unmount();
  queryClient.clear();
});
