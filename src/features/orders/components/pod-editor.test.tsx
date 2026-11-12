import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DeviceWorkContext, EMPTY_DEVICE_WORK } from '@/components/app-shell/device-work';
import { saveProofOfDelivery } from '@/features/orders/api/api';
import { PodEditor } from '@/features/orders/components/pod-editor';
import type { PodResponse, ProofOfDelivery } from '@/features/orders/lib/pod-types';
import type { OrderableFulfills } from '@/features/reference-data/lib/types';
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
const refreshOfflineDownload = vi.fn();
function setup(
  canEdit = true,
  initial = pod,
  products = [orderProduct],
  fulfills: OrderableFulfills = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <DeviceWorkContext value={{ ...EMPTY_DEVICE_WORK, refreshOfflineDownload }}>
        <PodEditor
          initial={initial}
          products={products}
          lots={[]}
          fulfills={fulfills}
          reasons={[{ id: 'damage', name: 'Damage' }]}
          canEdit={canEdit}
          timeZone="UTC"
          onCancel={vi.fn()}
        />
      </DeviceWorkContext>
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
it('drops reason and VVM errors once an accepted change makes them unnecessary', () => {
  setup(true, {
    ...pod,
    lineItems: [{ ...pod.lineItems[0], rejectionReasonId: null, useVvm: true }],
  });
  const accepted = screen.getByRole('textbox', { name: 'orders.pod.accepted-for' });
  const reason = screen.getByRole('combobox', { name: 'orders.pod.reason-for' });
  const vvm = screen.getByRole('combobox', { name: 'orders.pod.vvm-for' });
  for (const field of [reason, vvm]) {
    fireEvent.focus(field);
    fireEvent.blur(field);
  }
  expect(reason).toHaveAttribute('aria-invalid', 'true');
  expect(vvm).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(accepted, { target: { value: '8' } });
  expect(reason).not.toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(accepted, { target: { value: '0' } });
  expect(vvm).not.toHaveAttribute('aria-invalid', 'true');
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

it('requests a refresh of downloaded stock at the receiving facility after Confirm', async () => {
  vi.mocked(saveProofOfDelivery).mockImplementation(async (_, body) => ({
    ...pod,
    ...body,
    lineItems: pod.lineItems,
    shipment: { id: 'shipment' },
  }));
  const user = setup(true, {
    ...pod,
    receivedBy: 'Receiver',
    deliveredBy: 'Driver',
    receivedDate: '2026-01-05',
  });
  await user.click(screen.getByRole('button', { name: 'orders.pod.confirm' }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'orders.pod.confirm' }));
  await waitFor(() =>
    expect(refreshOfflineDownload).toHaveBeenCalledWith(
      `${pod.shipment.order.receivingFacility.id}:program`,
    ),
  );
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

it.each([false, true])(
  'renders one editable control set for a shared substitute and mirrors its values in cards=%s',
  async (cards) => {
    layout.cards = cards;
    const shared = {
      ...pod,
      shipment: {
        ...pod.shipment,
        order: {
          ...pod.shipment.order,
          orderLineItems: [
            ...pod.shipment.order.orderLineItems,
            {
              orderable: { ...orderProduct, id: 'alternate', fullProductName: 'Other Medicine' },
              orderedQuantity: 2,
            },
          ],
        },
      },
    };
    setup(true, shared, [orderProduct], { alternate: { canFulfillForMe: ['product'] } });
    const ids = Array.from(document.querySelectorAll('[id]'), (node) => node.id);
    expect(ids).toHaveLength(new Set(ids).size);
    const accepted = screen.getByRole('textbox', { name: 'orders.pod.accepted-for' });
    fireEvent.change(accepted, { target: { value: '8' } });
    await waitFor(() => expect(screen.getAllByText('8')).toHaveLength(3));
  },
);
