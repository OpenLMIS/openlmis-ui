import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import { WorkspaceSlots } from '@/components/workspace-tabs';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  createPhysicalInventoryLot,
  deactivateInventoryStockCard,
  deletePhysicalInventory,
  fetchEligibleInventoryProducts,
  fetchInventoryStockLines,
  fetchInventorySummaries,
  savePhysicalInventory,
  submitPhysicalInventory,
} from '@/features/stock-events/api/physical-inventory-api';
import {
  eligibleInventoryProductsOptions,
  inventoryStockLinesOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { PhysicalInventoryEditor } from '@/features/stock-events/components/physical-inventory-editor';
import {
  buildInventoryLines,
  inventoryGroups,
  inventoryPage,
} from '@/features/stock-events/lib/physical-inventory-lines';
import {
  clearInventoryLocal,
  readInventoryLocal,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

vi.mock('@/features/stock-events/lib/physical-inventory-lines', async (original) => {
  const actual =
    await original<typeof import('@/features/stock-events/lib/physical-inventory-lines')>();
  return {
    ...actual,
    inventoryGroups: vi.fn(actual.inventoryGroups),
    inventoryPage: vi.fn(actual.inventoryPage),
  };
});

vi.mock('@/components/data-table/responsive-columns', async (original) => ({
  ...(await original<typeof import('@/components/data-table/responsive-columns')>()),
  useElementWidth: () => [undefined, 1100],
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: { field?: string }) =>
      key === 'stock-events.field-of' &&
      options?.field &&
      options.field !== 'physical-inventory.current-stock'
        ? `${key}:${options.field}`
        : key,
  }),
}));
vi.mock('@/features/stock-events/lib/physical-inventory-local', () => ({
  readInventoryLocal: vi.fn(),
  clearInventoryLocal: vi.fn(),
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
  createPhysicalInventoryLot: vi.fn(),
  deactivateInventoryStockCard: vi.fn(),
  savePhysicalInventory: vi.fn(),
  submitPhysicalInventory: vi.fn(),
  deletePhysicalInventory: vi.fn(),
  fetchInventoryStockLines: vi.fn(),
  fetchEligibleInventoryProducts: vi.fn(),
  fetchInventorySummaries: vi.fn(),
  fetchPhysicalInventoryDraft: vi
    .fn()
    .mockResolvedValue({ id: 'd', programId: 'p', facilityId: 'f', lineItems: [] }),
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
  vi.mocked(clearInventoryLocal).mockResolvedValue(undefined);
  vi.mocked(savePhysicalInventory).mockResolvedValue(undefined);
  vi.mocked(submitPhysicalInventory).mockResolvedValue(undefined);
  vi.mocked(deletePhysicalInventory).mockResolvedValue(undefined);
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
      <WorkspaceSlots>
        <PhysicalInventoryEditor
          draft={draft}
          right="STOCK_INVENTORIES_EDIT"
          userId="user"
          username="user"
          onDeleted={vi.fn()}
          onSubmitted={vi.fn()}
          search={{ ...next, keyword: next.keyword, includeInactive: undefined }}
          onSearchChange={change}
          facilityTypeId="type"
          canManageLots
        />
      </WorkspaceSlots>
    </QueryClientProvider>
  );
  const view = render(tree(search));
  return { ...view, tree, client, change };
}
it('edits counts, updates difference and retains a count across pages and filters', async () => {
  const user = userEvent.setup();
  const view = setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  expect(
    screen.getByRole('button', { name: 'stock-events.field-of:physical-inventory.reasons' }),
  ).toBeDisabled();
  await user.type(input, '7');
  expect(within(screen.getByRole('table')).getByText('2')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'stock-events.field-of:physical-inventory.reasons' }),
  ).toBeEnabled();
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
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('physical-inventory.not-saved-local'),
  );
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
  await user.click(
    screen.getByRole('button', { name: 'stock-events.field-of:stock-events.actions' }),
  );
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
  await user.click(
    screen.getByRole('button', { name: 'stock-events.field-of:stock-events.actions' }),
  );
  await user.click(screen.getByRole('menuitem', { name: 'physical-inventory.delete-row' }));
  await waitFor(() =>
    expect(writeInventoryLocal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ key: 'A|none' }),
          expect.objectContaining({ key: 'B|none' }),
        ]),
        modified: true,
      }),
      expect.any(Number),
      expect.anything(),
    ),
  );
});

it('always confirms Save, sends hidden members, and clears the local copy only on success', async () => {
  const user = userEvent.setup();
  setup();
  await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  expect(savePhysicalInventory).not.toHaveBeenCalled();
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('physical-inventory.save-confirm')).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'physical-inventory.save' }));
  await waitFor(() =>
    expect(savePhysicalInventory).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [
          expect.objectContaining({ orderableId: 'A', quantity: -1 }),
          expect.objectContaining({ orderableId: 'B', quantity: -1 }),
        ],
      }),
    ),
  );
  await waitFor(() => expect(clearInventoryLocal).toHaveBeenCalledWith('d'));
});
it('validates hidden lines and moves to the first invalid product without posting', async () => {
  const user = userEvent.setup();
  const view = setup({ size: 1, page: 2 });
  await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(view.change).toHaveBeenCalledWith(
    expect.objectContaining({ keyword: undefined, page: undefined }),
    true,
  );
  expect(submitPhysicalInventory).not.toHaveBeenCalled();
  view.rerender(view.tree({ size: 1, page: 1 }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveAttribute(
      'aria-invalid',
      'true',
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveFocus(),
  );
});
it('keeps the local copy after a rejected Save', async () => {
  vi.mocked(savePhysicalInventory).mockRejectedValue(new Error('refused'));
  const user = userEvent.setup();
  setup();
  await user.type(await screen.findByRole('textbox', { name: 'stock-events.field-of' }), '5');
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  await waitFor(() => expect(savePhysicalInventory).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(clearInventoryLocal).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveValue('5');
});
it('requires Delete confirmation and clears the device copy after deletion', async () => {
  const user = userEvent.setup();
  setup();
  await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.click(screen.getByRole('button', { name: 'physical-inventory.delete' }));
  expect(deletePhysicalInventory).not.toHaveBeenCalled();
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.delete' }),
  );
  await waitFor(() => expect(clearInventoryLocal).toHaveBeenCalledWith('d'));
  expect(deletePhysicalInventory).toHaveBeenCalledWith('d');
});
it('never resends a Submit whose outcome is unknown and retains the copy', async () => {
  vi.mocked(submitPhysicalInventory).mockRejectedValue(new AxiosError('network'));
  vi.mocked(readInventoryLocal).mockResolvedValue({
    draftId: 'd',
    programId: 'p',
    facilityId: 'f',
    modified: true,
    savedAt: 1,
    lines: buildInventoryLines(stock, []).map((line) => ({
      ...line,
      quantity: quantityValue('5'),
    })),
  });
  const user = userEvent.setup();
  setup();
  await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'stock-events.confirm' }),
  );
  await screen.findByText('physical-inventory.unknown-outcome-description');
  expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled();
  expect(submitPhysicalInventory).toHaveBeenCalledTimes(1);
  expect(clearInventoryLocal).not.toHaveBeenCalled();
});

it('keeps Delete on an added row after Save replaces its editable lot with the server id', async () => {
  const local = {
    ...buildInventoryLines(stock, [])[0],
    key: 'A|new:new',
    stockCardId: null,
    stockOnHand: null,
    isAdded: true,
    justAdded: true,
    quantity: quantityValue('0'),
    newLot: { clientId: 'new', lotCode: 'NEW', expirationDate: null, tradeItemId: 't' },
  };
  vi.mocked(readInventoryLocal).mockResolvedValue({
    draftId: 'd',
    programId: 'p',
    facilityId: 'f',
    modified: true,
    savedAt: 1,
    lines: [local],
  });
  vi.mocked(createPhysicalInventoryLot).mockResolvedValue({
    id: 'created',
    lotCode: 'NEW',
    expirationDate: null,
  });
  const user = userEvent.setup();
  setup();
  await screen.findByRole('button', { name: 'stock-events.field-of:physical-inventory.edit-lot' });
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  await waitFor(() => expect(createPhysicalInventoryLot).toHaveBeenCalled());
  await waitFor(() => expect(savePhysicalInventory).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'stock-events.field-of:physical-inventory.edit-lot' }),
    ).not.toBeInTheDocument(),
  );
  expect(writeInventoryLocal).toHaveBeenCalledWith(
    expect.objectContaining({
      lines: expect.arrayContaining([
        expect.objectContaining({ key: 'A|created', justAdded: true, newLot: undefined }),
      ]),
    }),
  );
  expect(savePhysicalInventory).toHaveBeenCalledWith(
    expect.objectContaining({
      lineItems: expect.arrayContaining([
        expect.objectContaining({ lotId: 'created', quantity: 0 }),
      ]),
    }),
  );
  await user.click(
    screen.getByRole('button', { name: 'stock-events.field-of:stock-events.actions' }),
  );
  expect(
    screen.getByRole('menuitem', { name: 'physical-inventory.delete-row' }),
  ).toBeInTheDocument();
});
it('keeps the local copy after a refused Submit and offers another deliberate attempt', async () => {
  vi.mocked(submitPhysicalInventory).mockRejectedValue(
    new AxiosError('refused', undefined, undefined, undefined, {
      status: 400,
      data: { message: 'Refused' },
    } as never),
  );
  vi.mocked(readInventoryLocal).mockResolvedValue({
    draftId: 'd',
    programId: 'p',
    facilityId: 'f',
    modified: true,
    savedAt: 1,
    lines: buildInventoryLines(stock, []).map((line) => ({
      ...line,
      quantity: quantityValue('5'),
    })),
  });
  const user = userEvent.setup();
  setup();
  await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'stock-events.confirm' }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(clearInventoryLocal).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveValue('5');
  expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeEnabled();
});
it('submits exactly once, clears the copy, and offers the print choice', async () => {
  vi.mocked(readInventoryLocal).mockResolvedValue({
    draftId: 'd',
    programId: 'p',
    facilityId: 'f',
    modified: true,
    savedAt: 1,
    lines: buildInventoryLines(stock, []).map((line) => ({
      ...line,
      quantity: quantityValue('5'),
    })),
  });
  const user = userEvent.setup();
  const view = setup();
  const invalidate = vi.spyOn(view.client, 'invalidateQueries');
  await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'stock-events.confirm' }),
  );
  await screen.findByRole('heading', { name: 'physical-inventory.print-title' });
  expect(submitPhysicalInventory).toHaveBeenCalledTimes(1);
  expect(submitPhysicalInventory).toHaveBeenCalledWith(
    expect.objectContaining({
      resourceId: 'd',
      lineItems: [
        expect.objectContaining({ orderableId: 'A', quantity: 5 }),
        expect.objectContaining({ orderableId: 'B', quantity: 5 }),
      ],
    }),
  );
  expect(clearInventoryLocal).toHaveBeenCalledWith('d');
  expect(invalidate).toHaveBeenCalledTimes(4);
  await user.click(screen.getByRole('button', { name: 'physical-inventory.no' }));
  expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled();
});
it('opens the first invalid product page after applying the inactive filter', async () => {
  const user = userEvent.setup();
  const view = setup();
  const inactive = {
    ...stock[0],
    orderable: { ...stock[0].orderable, id: 'inactive', productCode: '0' },
    stockOnHand: 0,
    active: false,
  };
  view.client.setQueryData(inventoryStockLinesOptions(draft).queryKey, [inactive, ...stock]);
  view.client.setQueryData(eligibleInventoryProductsOptions(draft).queryKey, [inactive, ...stock]);
  await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(view.change).toHaveBeenCalledWith(expect.objectContaining({ page: undefined }), true);
});

it('accepts only digits in Current Stock, including Arabic and Persian digits', async () => {
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '-5.1x٢۳');
  expect(input).toHaveValue('5123');
});

it('describes reason errors on the row count input and renders their message in the grid', async () => {
  const local = {
    ...buildInventoryLines(stock, [])[0],
    quantity: quantityValue('5'),
    stockAdjustments: [{ reason: { id: 'r', reasonType: 'CREDIT' }, quantity: 0 }],
  };
  vi.mocked(readInventoryLocal).mockResolvedValue({
    draftId: 'd',
    facilityId: 'f',
    programId: 'p',
    lines: [local],
    modified: true,
    savedAt: 1,
  });
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  expect(input).toHaveAttribute('aria-invalid', 'true');
  const description = document.getElementById(input.getAttribute('aria-describedby') ?? '');
  expect(description).toHaveTextContent('physical-inventory.invalid-description');
});

it('moves focus to the next count when removing a just-added row', async () => {
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
    facilityId: 'f',
    programId: 'p',
    lines: [local],
    modified: true,
    savedAt: 1,
  });
  const user = userEvent.setup();
  const view = setup({ size: 20, page: 1 });
  view.client.setQueryData(eligibleInventoryProductsOptions(draft).queryKey, [...stock, local]);
  await waitFor(() =>
    expect(screen.getAllByRole('textbox', { name: 'stock-events.field-of' })).toHaveLength(3),
  );
  const inputs = screen.getAllByRole('textbox', { name: 'stock-events.field-of' });
  const row = inputs[0].closest('tr') as HTMLElement;
  await user.click(
    within(row).getByRole('button', { name: 'stock-events.field-of:stock-events.actions' }),
  );
  await user.click(screen.getByRole('menuitem', { name: 'physical-inventory.delete-row' }));
  await waitFor(() => expect(inputs[1]).toHaveFocus());
});

it('keeps sorting and paging stable during count entry while progress and saved counts update', async () => {
  const user = userEvent.setup();
  setup({ size: 20, page: 1 });
  const inputs = await screen.findAllByRole('textbox', { name: 'stock-events.field-of' });
  vi.mocked(inventoryPage).mockClear();
  vi.mocked(inventoryGroups).mockClear();
  await user.type(inputs[0], '12345');
  expect(inventoryPage).not.toHaveBeenCalled();
  expect(inventoryGroups).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(writeInventoryLocal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({
            key: 'A|none',
            quantity: expect.objectContaining({ doses: '12345' }),
          }),
          expect.objectContaining({
            key: 'B|none',
            quantity: expect.objectContaining({ doses: '' }),
          }),
        ]),
      }),
      expect.any(Number),
      expect.anything(),
    ),
  );
});
it('updates the unaccounted error immediately when reasons change without Submit', async () => {
  const { fetchValidReasons } = await import('@/features/reference-data/api/api');
  vi.mocked(fetchValidReasons).mockResolvedValueOnce([
    {
      reason: {
        id: 'r',
        name: 'Found',
        reasonType: 'CREDIT',
        reasonCategory: 'TRANSFER',
        isFreeTextAllowed: false,
        tags: [],
      },
      hidden: false,
    },
  ]);
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '7');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  await user.click(
    screen.getByRole('button', { name: 'stock-events.field-of:physical-inventory.reasons' }),
  );
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: 'Found' }));
  await user.type(within(dialog).getByRole('textbox', { name: 'stock-events.quantity' }), '2');
  await user.click(within(dialog).getByRole('button', { name: 'stock-events.add' }));
  await user.click(within(dialog).getByRole('button', { name: 'physical-inventory.update' }));
  expect(input).not.toHaveAttribute('aria-invalid', 'true');
});

it('keeps pagination inside the grid table card container', async () => {
  setup();
  await screen.findByRole('table');
  const pager = await screen.findByRole('button', { name: 'Next Page' });
  const grid = screen.getByRole('table');
  expect(grid.closest('.\\@container\\/table')).toContainElement(pager);
});
