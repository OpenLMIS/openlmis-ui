import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  deactivateInventoryStockCard,
  fetchEligibleInventoryProducts,
  fetchInventoryStockLines,
  fetchInventorySummaries,
} from '@/features/stock-events/api/physical-inventory-api';
import {
  eligibleInventoryProductsOptions,
  inventoryStockLinesOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { PhysicalInventoryEditor } from '@/features/stock-events/components/physical-inventory-editor';
import { buildInventoryLines } from '@/features/stock-events/lib/physical-inventory-lines';
import {
  readInventoryLocal,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

vi.mock('@/features/stock-events/lib/physical-inventory-local', () => ({
  readInventoryLocal: vi.fn(),
  writeInventoryLocal: vi.fn(),
}));
vi.mock('@/hooks/use-discard-guard', () => ({
  useDiscardGuard: vi.fn(() => ({
    dialog: { open: false, signingOut: false, onDiscard: vi.fn(), onKeepEditing: vi.fn() },
  })),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchValidReasons: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/hooks/use-quantity-unit', () => ({
  useQuantityUnit: () => {
    const [unit, setUnit] = useState<'DOSES' | 'PACKS'>('DOSES');
    return { unit, setUnit, canSwitch: true };
  },
}));
vi.mock('@/features/stock-events/api/physical-inventory-api', async (original) => ({
  ...(await original<typeof import('@/features/stock-events/api/physical-inventory-api')>()),
  deactivateInventoryStockCard: vi.fn(),
  fetchInventoryStockLines: vi.fn(),
  fetchEligibleInventoryProducts: vi.fn(),
  fetchInventorySummaries: vi.fn(),
}));
const draft = { id: 'd', programId: 'p', facilityId: 'f', lineItems: [] };
const stock = ['A', 'B'].map((id) => ({
  orderable: { id, productCode: id, fullProductName: id, description: null, netContent: 10 },
  lot: null,
  stockOnHand: 5,
  stockCardId: id,
  active: true,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchInventoryStockLines).mockResolvedValue(stock);
  vi.mocked(fetchEligibleInventoryProducts).mockResolvedValue(stock);
  vi.mocked(fetchInventorySummaries).mockResolvedValue([]);
  vi.mocked(deactivateInventoryStockCard).mockResolvedValue(undefined);
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'user', username: 'user', accessToken: 'token' });
  vi.mocked(readInventoryLocal).mockResolvedValue(undefined);
  vi.mocked(writeInventoryLocal).mockResolvedValue(undefined);
});
function setup(search = { size: 1, page: 1 }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(inventoryStockLinesOptions(draft).queryKey, stock);
  client.setQueryData(eligibleInventoryProductsOptions(draft).queryKey, stock);
  const change = vi.fn();
  const tree = (next: { page: number; size: number; keyword?: string }) => (
    <QueryClientProvider client={client}>
      <PhysicalInventoryEditor
        draft={draft}
        search={{ ...next, keyword: next.keyword, includeInactive: undefined }}
        onSearchChange={change}
        facilityTypeId="type"
        canManageLots
      />
    </QueryClientProvider>
  );
  const view = render(tree(search));
  return { ...view, tree, client, change };
}
it('edits counts, updates difference and retains a count across pages and filters', async () => {
  const user = userEvent.setup();
  const view = setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  expect(screen.getByRole('button', { name: 'physical-inventory.add-reasons' })).toBeDisabled();
  await user.type(input, '7');
  expect(within(screen.getByRole('table')).getByText('2')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'physical-inventory.add-reasons' })).toBeEnabled();
  view.rerender(view.tree({ size: 1, page: 2 }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveValue(''),
  );
  view.rerender(view.tree({ size: 1, page: 1, keyword: 'A' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveValue('7'),
  );
  await waitFor(() => expect(writeInventoryLocal).toHaveBeenCalled());
});
it('shows inline count errors without losing the typed text', async () => {
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '2147483648');
  await user.tab();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveValue('2147483648');
});
it('restores a modified local count ahead of the server and marks only pending or failed writes dirty', async () => {
  const line = { ...buildInventoryLines(stock, [])[0], quantity: quantityValue('9', 10) };
  vi.mocked(readInventoryLocal).mockResolvedValue({
    draftId: 'd',
    programId: 'p',
    facilityId: 'f',
    lines: [line],
    modified: true,
    savedAt: 1,
  });
  const write = Promise.withResolvers<void>();
  vi.mocked(writeInventoryLocal).mockReturnValue(write.promise);
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  expect(input).toHaveValue('9');
  await user.clear(input);
  await user.type(input, '8');
  expect(screen.getByText('physical-inventory.saving')).toBeInTheDocument();
  expect(useDiscardGuard).toHaveBeenLastCalledWith(true);
  write.resolve();
  await waitFor(() =>
    expect(screen.getByText('physical-inventory.saved-local')).toBeInTheDocument(),
  );
  expect(useDiscardGuard).toHaveBeenLastCalledWith(false);
});
it('keeps edited counts visible after storage failure', async () => {
  vi.mocked(writeInventoryLocal).mockRejectedValue(new Error('Full'));
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '8');
  await screen.findByText('physical-inventory.not-saved-local');
  expect(input).toHaveValue('8');
  expect(useDiscardGuard).toHaveBeenLastCalledWith(true);
});

it('keeps doses when switching through packs and remainder', async () => {
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '17');
  await user.click(screen.getByRole('radio', { name: 'quantity-unit.packs' }));
  const packs = screen.getByRole('textbox', { name: 'stock-events.field-of quantity-unit.packs' });
  const remainder = screen.getByRole('textbox', {
    name: 'stock-events.field-of quantity-unit.doses',
  });
  expect(packs).toHaveValue('1');
  expect(remainder).toHaveValue('7');
  await user.clear(packs);
  await user.type(packs, '2');
  await user.click(screen.getByRole('radio', { name: 'quantity-unit.doses' }));
  expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveValue('27');
});
it('confirms deactivation before making the request', async () => {
  const user = userEvent.setup();
  const view = setup();
  view.client.setQueryData(inventoryStockLinesOptions(draft).queryKey, [
    { ...stock[0], stockOnHand: 0 },
  ]);
  await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.click(screen.getByRole('button', { name: 'stock-events.field-of' }));
  await user.click(screen.getByRole('menuitem', { name: 'physical-inventory.deactivate' }));
  expect(deactivateInventoryStockCard).not.toHaveBeenCalled();
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'physical-inventory.deactivate' }));
  await waitFor(() =>
    expect(deactivateInventoryStockCard).toHaveBeenCalledWith('A', expect.anything()),
  );
});
it('writes removal of the last locally added line so it cannot return on reopen', async () => {
  const local = {
    ...buildInventoryLines(stock, [])[0],
    key: 'C|none',
    orderable: { ...stock[0].orderable, id: 'C', productCode: '0', fullProductName: 'New Product' },
    stockCardId: null,
    stockOnHand: null,
    justAdded: true,
    isAdded: true,
    quantity: quantityValue('0'),
  };
  vi.mocked(readInventoryLocal).mockResolvedValue({
    draftId: 'd',
    programId: 'p',
    facilityId: 'f',
    lines: [local],
    modified: true,
    savedAt: 1,
  });
  const user = userEvent.setup();
  const view = setup();
  view.client.setQueryData(eligibleInventoryProductsOptions(draft).queryKey, [...stock, local]);
  await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.click(screen.getByRole('button', { name: 'stock-events.field-of' }));
  await user.click(screen.getByRole('menuitem', { name: 'physical-inventory.delete-row' }));
  await waitFor(() =>
    expect(writeInventoryLocal).toHaveBeenLastCalledWith(
      expect.objectContaining({ lines: [], modified: true }),
      expect.any(Number),
      expect.anything(),
    ),
  );
});
