import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import type { ComponentProps } from 'react';
import { toast } from 'sonner';
import { beforeEach, expect, it, vi } from 'vitest';
import { WorkspaceSlots } from '@/components/workspace-tabs';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  deletePhysicalInventory,
  fetchEligibleInventoryProducts,
  fetchPhysicalInventoryDraft,
  savePhysicalInventory,
  submitPhysicalInventory,
} from '@/features/stock-events/api/physical-inventory-api';
import {
  eligibleInventoryProductsOptions,
  physicalInventoryDraftOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { InventoryActions } from '@/features/stock-events/components/inventory-actions';
import { buildInventoryLines } from '@/features/stock-events/lib/physical-inventory-lines';
import { clearInventoryLocal } from '@/features/stock-events/lib/physical-inventory-local';

vi.mock('@/features/stock-events/api/physical-inventory-api', () => ({
  savePhysicalInventory: vi.fn(),
  submitPhysicalInventory: vi.fn(),
  deletePhysicalInventory: vi.fn(),
  fetchPhysicalInventoryReport: vi.fn(),
  createPhysicalInventoryLot: vi.fn(),
  fetchPhysicalInventoryDraft: vi.fn().mockResolvedValue(null),
  fetchEligibleInventoryProducts: vi.fn().mockResolvedValue([]),
  fetchInventorySummaries: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/features/stock-events/lib/physical-inventory-local', () => ({
  clearInventoryLocal: vi.fn(),
  writeInventoryLocal: vi.fn(),
}));
vi.mock('@/hooks/use-print-report', () => ({ usePrintReport: vi.fn(() => ({ print: vi.fn() })) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const draft = { id: 'd', facilityId: 'f', programId: 'p', lineItems: [] };
const stock = {
  orderable: { id: 'p', productCode: 'P', fullProductName: 'Product', description: null },
  lot: null,
  stockOnHand: 5,
  stockCardId: 'c',
  active: true,
};
const lines = buildInventoryLines([stock], [{ orderableId: 'p', quantity: 5 }]);
beforeEach(() => {
  vi.clearAllMocks();
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'user', username: 'user', accessToken: 'token' });
  vi.mocked(clearInventoryLocal).mockResolvedValue(undefined);
  vi.mocked(savePhysicalInventory).mockResolvedValue(undefined);
  vi.mocked(deletePhysicalInventory).mockResolvedValue(undefined);
  vi.mocked(submitPhysicalInventory).mockResolvedValue(undefined);
});
function setup(overrides: Partial<ComponentProps<typeof InventoryActions>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(eligibleInventoryProductsOptions(draft).queryKey, [stock]);
  const fetch = vi.spyOn(client, 'fetchQuery');
  const onSaved = vi.fn();
  const onDeleted = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <WorkspaceSlots>
        <InventoryActions
          draft={draft}
          baseline={lines}
          right="STOCK_INVENTORIES_EDIT"
          getLines={() => lines}
          includeInactive={false}
          displayed={lines}
          userId="user"
          username="user"
          showInDoses
          disabled={false}
          flush={vi.fn()}
          onBusy={vi.fn()}
          onLots={vi.fn()}
          onSaved={onSaved}
          onDialogChange={vi.fn()}
          onInvalid={vi.fn()}
          onDeleted={onDeleted}
          onSubmitted={vi.fn()}
          {...overrides}
        />
      </WorkspaceSlots>
    </QueryClientProvider>,
  );
  return { fetch, onSaved, onDeleted, client };
}
it('refetches Save with the facility/program key rather than the draft object', async () => {
  const user = userEvent.setup();
  const { fetch } = setup();
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: physicalInventoryDraftOptions({ facilityId: 'f', programId: 'p' }).queryKey,
      }),
    ),
  );
});
it.each(['save', 'delete', 'submit'] as const)(
  'reports a successful server %s separately from device cleanup failure',
  async (action) => {
    const user = userEvent.setup();
    vi.mocked(clearInventoryLocal).mockRejectedValue(new Error('Full'));
    const { onSaved, onDeleted } = setup();
    await user.click(
      screen.getByRole('button', {
        name: action === 'submit' ? 'stock-events.submit' : `physical-inventory.${action}`,
      }),
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: action === 'submit' ? 'stock-events.confirm' : `physical-inventory.${action}`,
      }),
    );
    await waitFor(() => expect(action === 'delete' ? onDeleted : onSaved).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith('physical-inventory.local-clear-error-title', {
      description: `physical-inventory.${action}-local-clear-error`,
    });
  },
);
it('uses inventory wording for an unknown submit outcome and prevents a retry', async () => {
  const user = userEvent.setup();
  vi.mocked(submitPhysicalInventory).mockRejectedValue(new AxiosError('Network'));
  setup();
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'stock-events.confirm' }),
  );
  const alert = await screen.findByRole('alertdialog');
  expect(alert).toHaveTextContent('physical-inventory.unknown-outcome-description');
  await user.click(within(alert).getByRole('button', { name: 'dialog.close' }));
  expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'physical-inventory.save' })).toHaveFocus(),
  );
  expect(toast.error).not.toHaveBeenCalled();
});

it.each(['save', 'submit'] as const)(
  'waits for in-flight eligibility before confirming %s',
  async (action) => {
    const user = userEvent.setup();
    const { client } = setup();
    await user.click(
      screen.getByRole('button', {
        name: action === 'save' ? 'physical-inventory.save' : 'stock-events.submit',
      }),
    );
    const fresh = Promise.withResolvers<(typeof stock)[]>();
    vi.mocked(fetchEligibleInventoryProducts).mockReturnValueOnce(fresh.promise);
    let refresh!: Promise<unknown>;
    act(() => {
      refresh = client.fetchQuery({ ...eligibleInventoryProductsOptions(draft), staleTime: 0 });
    });
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: action === 'save' ? 'physical-inventory.save' : 'stock-events.confirm',
      }),
    );
    expect(savePhysicalInventory).not.toHaveBeenCalled();
    expect(submitPhysicalInventory).not.toHaveBeenCalled();
    await act(async () => {
      fresh.resolve([stock]);
      await refresh;
    });
    await waitFor(() =>
      expect(
        action === 'save' ? savePhysicalInventory : submitPhysicalInventory,
      ).toHaveBeenCalled(),
    );
  },
);
it('closes Save at success while the server draft refresh is still pending', async () => {
  const user = userEvent.setup();
  const fresh = Promise.withResolvers<null>();
  vi.mocked(fetchPhysicalInventoryDraft).mockReturnValueOnce(fresh.promise);
  setup();
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await act(async () => {
    fresh.resolve(null);
  });
});
it('navigates after Delete without resetting the draft to empty lines', async () => {
  const user = userEvent.setup();
  const { onSaved, onDeleted } = setup();
  await user.click(screen.getByRole('button', { name: 'physical-inventory.delete' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.delete' }),
  );
  await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  expect(onSaved).not.toHaveBeenCalled();
});

it('disables Save and Submit throughout an eligibility refresh without disabling Delete', async () => {
  const { client } = setup();
  const fresh = Promise.withResolvers<(typeof stock)[]>();
  vi.mocked(fetchEligibleInventoryProducts).mockReturnValueOnce(fresh.promise);
  let refresh!: Promise<unknown>;
  act(() => {
    refresh = client.fetchQuery({ ...eligibleInventoryProductsOptions(draft), staleTime: 0 });
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'physical-inventory.save' })).toBeDisabled(),
  );
  expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'physical-inventory.delete' })).toBeEnabled();
  await act(async () => {
    fresh.resolve([stock]);
    await refresh;
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'physical-inventory.save' })).toBeEnabled(),
  );
});

it('opens invalid Submit as an alert and focuses the count only after Close', async () => {
  const user = userEvent.setup();
  const invalid = lines.map((line) => ({ ...line, quantity: { ...line.quantity, doses: '' } }));
  const input = document.createElement('input');
  document.body.append(input);
  const onInvalid = vi.fn(() => input.focus());
  setup({ getLines: () => invalid, displayed: invalid, onInvalid });
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  const alert = screen.getByRole('alertdialog');
  expect(alert).toHaveTextContent('physical-inventory.invalid-description');
  expect(onInvalid).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
  await user.click(within(alert).getByRole('button', { name: 'dialog.close' }));
  await waitFor(() => expect(onInvalid).toHaveBeenCalledWith(invalid));
  expect(input).toHaveFocus();
  input.remove();
});
it('opens an inactive Submit alert and returns focus to Submit after Close', async () => {
  const user = userEvent.setup();
  const inactive = lines.map((line) => ({ ...line, active: false, stockOnHand: 0 }));
  const onInvalid = vi.fn();
  setup({ getLines: () => inactive, displayed: inactive, onInvalid });
  const submit = screen.getByRole('button', { name: 'stock-events.submit' });
  await user.click(submit);
  const alert = screen.getByRole('alertdialog');
  expect(alert).toHaveTextContent('physical-inventory.inactive-description');
  await user.click(within(alert).getByRole('button', { name: 'dialog.close' }));
  await waitFor(() => expect(submit).toHaveFocus());
  expect(onInvalid).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});
it.each(['save', 'delete', 'submit'] as const)(
  'opens an alert for a %s server failure',
  async (action) => {
    const user = userEvent.setup();
    const type = action;
    const request =
      type === 'save'
        ? savePhysicalInventory
        : type === 'delete'
          ? deletePhysicalInventory
          : submitPhysicalInventory;
    vi.mocked(request).mockRejectedValueOnce(new Error('Failed'));
    setup();
    await user.click(
      screen.getByRole('button', {
        name: type === 'submit' ? 'stock-events.submit' : `physical-inventory.${type}`,
      }),
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: type === 'submit' ? 'stock-events.confirm' : `physical-inventory.${type}`,
      }),
    );
    const alert = await screen.findByRole('alertdialog');
    expect(alert).toHaveTextContent(`physical-inventory.${type}-error-description`);
    expect(toast.error).not.toHaveBeenCalled();
    await user.click(within(alert).getByRole('button', { name: 'dialog.close' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'stock-events.submit' })).toHaveFocus(),
    );
  },
);
