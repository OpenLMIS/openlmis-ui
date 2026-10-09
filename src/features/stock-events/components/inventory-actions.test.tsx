import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { beforeEach, expect, it, vi } from 'vitest';
import { WorkspaceSlots } from '@/components/workspace-tabs';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  deletePhysicalInventory,
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
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(eligibleInventoryProductsOptions(draft).queryKey, [stock]);
  const fetch = vi.spyOn(client, 'fetchQuery');
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <WorkspaceSlots>
        <InventoryActions
          draft={draft}
          baseline={lines}
          right="STOCK_INVENTORIES_EDIT"
          lines={lines}
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
          onDeleted={vi.fn()}
          onSubmitted={vi.fn()}
        />
      </WorkspaceSlots>
    </QueryClientProvider>,
  );
  return { fetch, onSaved };
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
    const { onSaved } = setup();
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
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
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
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled(),
  );
  expect(toast.error).toHaveBeenCalledWith('stock-events.unknown-outcome-title', {
    description: 'physical-inventory.unknown-outcome-description',
  });
});
