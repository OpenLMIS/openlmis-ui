import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { saveProofOfDelivery } from '@/features/orders/api/api';
import { PodEditor } from '@/features/orders/components/pod-editor';
import type { PodResponse, ProofOfDelivery } from '@/features/orders/lib/pod-types';
import { creatingOrder, orderProduct } from '@/test-utils/order-fixtures';

const layout = vi.hoisted(() => ({ cards: false }));
vi.mock('@/hooks/use-card-view', () => ({
  useCardLayout: () => ({ cards: layout.cards, measure: () => {} }),
}));
const print = vi.hoisted(() => ({
  run: vi.fn(),
  before: undefined as undefined | (() => Promise<boolean>),
}));
vi.mock('@/components/app-shell/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
vi.mock('@/hooks/use-discard-guard', () => ({
  useDiscardGuard: () => ({
    dialog: { open: false, signingOut: false, onDiscard: vi.fn(), onKeepEditing: vi.fn() },
  }),
}));
vi.mock('@/hooks/use-print-report', () => ({
  usePrintReport: (options: { beforeRequest: () => Promise<boolean> }) => {
    print.before = options.beforeRequest;
    return { isPending: false, offline: false, print: print.run };
  },
}));
vi.mock('@/features/orders/api/api', () => ({ saveProofOfDelivery: vi.fn() }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  layout.cards = false;
});
const pod: ProofOfDelivery = {
  id: 'pod',
  status: 'INITIATED',
  receivedBy: null,
  deliveredBy: null,
  receivedDate: null,
  shipment: {
    id: 'shipment',
    order: {
      ...creatingOrder(),
      status: 'SHIPPED',
      facility: { id: 'facility', name: 'Facility', type: { id: 'type' } },
    },
    lineItems: [{ orderable: { id: 'product' }, lot: null, quantityShipped: 8 }],
  },
  lineItems: [
    {
      id: 'line',
      orderable: { id: 'product', versionNumber: 2 },
      lot: null,
      quantityAccepted: 3,
      quantityRejected: 5,
      vvmStatus: null,
      useVvm: false,
      rejectionReasonId: 'damage',
      notes: '',
    },
  ],
};
function setup(canEdit = true, initial = pod, products = [orderProduct]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <PodEditor
        initial={initial}
        products={products}
        lots={[]}
        fulfills={{}}
        reasons={[{ id: 'damage', name: 'Damage' }]}
        canEdit={canEdit}
        timeZone="UTC"
        onCancel={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
it('prints directly for a viewer without any writable fields or save', async () => {
  setup(false);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'orders.pod.save' })).not.toBeInTheDocument();
  expect(await print.before?.()).toBe(true);
  expect(saveProofOfDelivery).not.toHaveBeenCalled();
});
it('clears a rejection reason only after a valid accepted quantity leaves nothing returned', async () => {
  setup();
  const accepted = screen.getByRole('textbox', { name: 'orders.pod.accepted-for' });
  const reason = screen.getByRole('combobox', { name: 'orders.pod.reason-for' });
  fireEvent.change(accepted, { target: { value: '' } });
  expect(reason).toHaveTextContent('Damage');
  fireEvent.change(accepted, { target: { value: '8' } });
  expect(reason).toHaveTextContent('orders.pod.select-reason');
});
it('keeps typing during save dirty and sends the submitted values', async () => {
  const request = Promise.withResolvers<PodResponse>();
  vi.mocked(saveProofOfDelivery).mockReturnValue(request.promise);
  const user = setup();
  const accepted = screen.getByRole('textbox', { name: 'orders.pod.accepted-for' });
  fireEvent.change(accepted, { target: { value: '5' } });
  await user.click(screen.getByRole('button', { name: 'orders.pod.save' }));
  await waitFor(() => expect(saveProofOfDelivery).toHaveBeenCalledOnce());
  expect(vi.mocked(saveProofOfDelivery).mock.calls[0][1].lineItems[0]).toMatchObject({
    quantityAccepted: 5,
    quantityRejected: 3,
  });
  fireEvent.change(accepted, { target: { value: '6' } });
  await act(async () =>
    request.resolve({
      ...pod,
      shipment: { id: 'shipment' },
      lineItems: [{ ...pod.lineItems[0], quantityAccepted: 5, quantityRejected: 3 }],
    }),
  );
  expect(accepted).toHaveValue('6');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'orders.pod.save' })).toBeEnabled(),
  );
});

it('blocks confirmation when required delivery details are missing', async () => {
  const user = setup();
  await user.click(screen.getByRole('button', { name: 'orders.pod.confirm' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('orders.pod.invalid-form');
  expect(saveProofOfDelivery).not.toHaveBeenCalled();
});

it.each([false, true])('shows the unit of an unmatched fulfilling product in cards=%s', (cards) => {
  layout.cards = cards;
  const substitute = {
    ...orderProduct,
    id: 'substitute',
    fullProductName: 'Substitute',
    dispensable: { displayUnit: 'bottle' },
  };
  const initial = {
    ...pod,
    lineItems: [{ ...pod.lineItems[0], orderable: { id: substitute.id, versionNumber: 2 } }],
    shipment: {
      ...pod.shipment,
      lineItems: [{ orderable: { id: substitute.id }, lot: null, quantityShipped: 8 }],
    },
  };
  setup(false, initial, [orderProduct, substitute]);
  expect(screen.getByText('bottle')).toBeVisible();
});
