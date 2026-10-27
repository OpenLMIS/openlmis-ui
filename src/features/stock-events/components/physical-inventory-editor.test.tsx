import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { toast } from 'sonner';
import { beforeEach, expect, it, vi } from 'vitest';
import { toDateValue } from '@/components/form/date-value';
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
import { InventoryOrphans } from '@/features/stock-events/components/inventory-orphans';
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
import { inventoryWrite } from '@/tests/inventory-writes';

vi.mock('@/features/stock-events/lib/physical-inventory-lines', async (original) => {
  const actual =
    await original<typeof import('@/features/stock-events/lib/physical-inventory-lines')>();
  return {
    ...actual,
    inventoryGroups: vi.fn(actual.inventoryGroups),
    inventoryPage: vi.fn(actual.inventoryPage),
  };
});

vi.mock('@/hooks/use-deployment-time-zone', () => ({ useDeploymentTimeZone: () => 'UTC' }));
vi.mock('react-i18next', () => ({
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
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
vi.mock('@/features/stock-events/lib/physical-inventory-local', async (original) => ({
  ...(await original<typeof import('@/features/stock-events/lib/physical-inventory-local')>()),
  reconcileInventoryCopies: vi.fn().mockResolvedValue(undefined),
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
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
  vi.clearAllMocks();
  vi.mocked(useDiscardGuard).mockImplementation(() => ({
    dialog: { open: false, signingOut: false, onDiscard: vi.fn(), onKeepEditing: vi.fn() },
    leaveIfAsked: vi.fn(),
  }));
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
function setup(
  search = { size: 1, page: 1 },
  onDeleted: () => void = vi.fn(),
  onSubmitted = vi.fn(),
  initialStock = stock,
  routed = false,
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { networkMode: 'always' },
    },
  });
  client.setQueryData(inventoryStockLinesOptions(draft).queryKey, initialStock);
  client.setQueryData(eligibleInventoryProductsOptions(draft).queryKey, initialStock);
  const change = vi.fn();
  const tree = (next: { page: number; size: number; keyword?: string; includeInactive?: true }) => (
    <QueryClientProvider client={client}>
      <WorkspaceSlots>
        <PhysicalInventoryEditor
          draft={draft}
          right="STOCK_INVENTORIES_EDIT"
          userId="user"
          username="user"
          onDeleted={onDeleted}
          onSubmitted={onSubmitted}
          search={{ ...next, keyword: next.keyword, includeInactive: next.includeInactive }}
          onSearchChange={change}
          facilityTypeId="type"
          canManageLots
        />
      </WorkspaceSlots>
    </QueryClientProvider>
  );
  const root = createRootRoute({ component: Outlet });
  const editorRoute = createRoute({
    getParentRoute: () => root,
    path: '/inventory',
    component: () => tree(search),
  });
  const listRoute = createRoute({
    getParentRoute: () => root,
    path: '/stock-management/physical-inventory',
    component: () => <p>Inventory list</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([editorRoute, listRoute]),
    history: createMemoryHistory({ initialEntries: ['/inventory'] }),
  });
  const view = render(routed ? <RouterProvider router={router} /> : tree(search));
  return { ...view, tree, client, change, router };
}
it('edits counts, updates difference and retains a count across pages and filters', async () => {
  const user = userEvent.setup();
  const view = setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  expect(screen.getByRole('button', { name: /physical-inventory.reasons/ })).toBeDisabled();
  await user.type(input, '7');
  expect(within(screen.getByRole('table')).getByText('2')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /physical-inventory.reasons/ })).toBeEnabled();
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
  vi.mocked(writeInventoryLocal).mockReturnValue(write.promise.then(() => undefined));
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  expect(input).toHaveValue('9');
  await user.clear(input);
  await user.type(input, '8');
  expect(screen.getByText('stock-events.draft-saving')).toBeInTheDocument();
  expect(useDiscardGuard).toHaveBeenLastCalledWith(true, expect.any(Object));
  write.resolve();
  await waitFor(() => expect(screen.getByText('stock-events.draft-saved')).toBeInTheDocument());
  expect(useDiscardGuard).toHaveBeenLastCalledWith(false, expect.any(Object));
});
it('keeps edited counts visible after storage failure and retries the write', async () => {
  vi.mocked(writeInventoryLocal).mockRejectedValue(new Error('Full'));
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '8');
  const retry = await screen.findByRole('button', { name: 'stock-events.draft-retry' });
  expect(screen.getByText('stock-events.draft-failed')).toBeInTheDocument();
  expect(input).toHaveValue('8');
  expect(useDiscardGuard).toHaveBeenLastCalledWith(true, expect.any(Object));
  const calls = vi.mocked(writeInventoryLocal).mock.calls.length;
  vi.mocked(writeInventoryLocal).mockResolvedValue(undefined);
  await user.click(retry);
  await waitFor(() => expect(screen.getByText('stock-events.draft-saved')).toBeInTheDocument());
  expect(vi.mocked(writeInventoryLocal).mock.calls.length).toBeGreaterThan(calls);
  expect(vi.mocked(writeInventoryLocal).mock.lastCall?.[0].lines[0].quantity?.doses).toBe('8');
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
    screen.getByRole('button', { name: 'stock-events.field-of:physical-inventory.deactivate' }),
  );
  expect(deactivateInventoryStockCard).not.toHaveBeenCalled();
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'physical-inventory.deactivate' }));
  await waitFor(() => expect(deactivateInventoryStockCard).toHaveBeenCalledWith('A'));
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
    screen.getByRole('button', { name: 'stock-events.field-of:physical-inventory.delete-row' }),
  );
  await waitFor(() =>
    expect(writeInventoryLocal).toHaveBeenLastCalledWith(
      ...inventoryWrite(
        expect.objectContaining({
          lines: [
            expect.objectContaining({ key: 'A|none' }),
            expect.objectContaining({ key: 'B|none' }),
          ],
          modified: true,
        }),
      ),
    ),
  );
});

it('always confirms Save, sends hidden members, and retains an unmodified device copy', async () => {
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
  await waitFor(() =>
    expect(writeInventoryLocal).toHaveBeenCalledWith(
      ...inventoryWrite(
        expect.objectContaining({ draftId: 'd', modified: false, baselineKeys: expect.any(Array) }),
      ),
    ),
  );
  expect(clearInventoryLocal).not.toHaveBeenCalled();
});

it('stores an unmodified copy with its products on an online open', async () => {
  setup();
  await waitFor(() =>
    expect(writeInventoryLocal).toHaveBeenCalledWith(
      expect.objectContaining({ draftId: 'd', modified: false }),
      expect.any(Number),
      expect.anything(),
      expect.objectContaining({
        draftId: 'd',
        eligible: stock.map(({ orderable }) =>
          expect.objectContaining({ orderable: expect.objectContaining({ id: orderable.id }) }),
        ),
      }),
      undefined,
      expect.objectContaining({ snapshotOnly: true }),
    ),
  );
});

async function submitAndReturnToInvalidPage(
  user: ReturnType<typeof userEvent.setup>,
  view: ReturnType<typeof setup>,
) {
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
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
  const input = screen.getByRole('textbox', { name: 'stock-events.field-of' });
  await waitFor(() => expect(input).toHaveFocus());
  return input;
}
it('scrolls the invalid phone card to the top and focuses its product', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(390);
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
  const user = userEvent.setup();
  const view = setup({ size: 1, page: 2 });
  await screen.findByText('B (B)');
  const input = await submitAndReturnToInvalidPage(user, view);
  const card = scroll.mock.contexts.indexOf(input.closest('li'));
  expect(scroll.mock.calls[card]).toEqual([{ block: 'start' }]);
});
it('waits for the invalid count page after clearing a keyword before focusing', async () => {
  vi.mocked(readInventoryLocal).mockResolvedValue({
    draftId: 'd',
    facilityId: 'f',
    programId: 'p',
    lines: buildInventoryLines(stock, []).map((line, index) => ({
      ...line,
      quantity: quantityValue(index === 0 ? '5' : '7'),
    })),
    modified: true,
    savedAt: 1,
  });
  const user = userEvent.setup();
  const view = setup();
  view.rerender(view.tree({ size: 1, page: 1, keyword: 'B' }));
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await waitFor(() => expect(input).toHaveValue('7'));
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
  );
  await waitFor(() =>
    expect(view.change).toHaveBeenCalledWith({ keyword: undefined, page: 2 }, true),
  );
  expect(document.activeElement).not.toBe(input);
  view.rerender(view.tree({ size: 1, page: 2 }));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'stock-events.field-of' }),
    ),
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
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
  );
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
  await waitFor(() =>
    expect(clearInventoryLocal).toHaveBeenCalledWith(
      'd',
      expect.any(Number),
      expect.any(Number),
      expect.anything(),
    ),
  );
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
  const alert = await screen.findByRole('alertdialog');
  expect(alert).toHaveTextContent('physical-inventory.unknown-outcome-description');
  await user.click(within(alert).getByRole('button', { name: 'dialog.close' }));
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
    newLot: { clientId: 'new', lotCode: 'NEW', expirationDate: '2030-01-30', tradeItemId: 't' },
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
    expirationDate: '2030-01-30',
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
  expect(createPhysicalInventoryLot).toHaveBeenCalledWith({
    lotCode: 'NEW',
    expirationDate: '2030-01-30',
    tradeItemId: 't',
    active: true,
  });
  expect(vi.mocked(savePhysicalInventory).mock.calls[0][0]).toEqual({
    id: 'd',
    facilityId: 'f',
    programId: 'p',
    lineItems: expect.arrayContaining([
      {
        orderableId: 'A',
        lotId: 'created',
        quantity: 0,
        extraData: {},
        stockAdjustments: [],
      },
    ]),
  });
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'stock-events.field-of:physical-inventory.edit-lot' }),
    ).not.toBeInTheDocument(),
  );
  expect(writeInventoryLocal).toHaveBeenCalledWith(
    ...inventoryWrite(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ key: 'A|created', justAdded: true, newLot: undefined }),
        ]),
      }),
    ),
  );
  expect(savePhysicalInventory).toHaveBeenCalledWith(
    expect.objectContaining({
      lineItems: expect.arrayContaining([
        expect.objectContaining({ lotId: 'created', quantity: 0 }),
      ]),
    }),
  );
  expect(
    screen.getByRole('button', { name: 'stock-events.field-of:physical-inventory.delete-row' }),
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
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
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
        expect.objectContaining({
          orderableId: 'A',
          quantity: 5,
          occurredDate: toDateValue(new Date()),
        }),
        expect.objectContaining({
          orderableId: 'B',
          quantity: 5,
          occurredDate: toDateValue(new Date()),
        }),
      ],
    }),
  );
  expect(clearInventoryLocal).toHaveBeenCalledWith(
    'd',
    expect.any(Number),
    expect.any(Number),
    expect.anything(),
  );
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
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
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
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
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
    within(row).getByRole('button', {
      name: 'stock-events.field-of:physical-inventory.delete-row',
    }),
  );
  await waitFor(() => expect(inputs[1]).toHaveFocus());
});

it('keeps sorting and paging stable during count entry while progress and saved counts update', async () => {
  const user = userEvent.setup();
  setup({ size: 20, page: 1 });
  const inputs = await screen.findAllByRole('textbox', { name: 'stock-events.field-of' });
  const progress = screen.getByRole('progressbar');
  expect(progress).toHaveAttribute('aria-valuenow', '0');
  vi.mocked(inventoryPage).mockClear();
  vi.mocked(inventoryGroups).mockClear();
  await user.type(inputs[0], '12345');
  expect(progress).toHaveAttribute('aria-valuenow', '50');
  expect(inventoryPage).not.toHaveBeenCalled();
  expect(inventoryGroups).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(writeInventoryLocal).toHaveBeenLastCalledWith(
      ...inventoryWrite(
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
      ),
    ),
  );
});
it('updates the phone card unaccounted error and summary when reasons change without Submit', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(390);
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
  expect(input).toHaveAttribute('aria-describedby');
  await user.click(screen.getByRole('button', { name: /physical-inventory.reasons/ }));
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: 'Found' }));
  await user.type(within(dialog).getByRole('textbox', { name: 'stock-events.quantity' }), '2');
  await user.click(within(dialog).getByRole('button', { name: 'stock-events.add' }));
  await user.click(within(dialog).getByRole('button', { name: 'physical-inventory.update' }));
  expect(input).not.toHaveAttribute('aria-describedby');
  expect(screen.getByRole('button', { name: /physical-inventory.reasons/ })).toHaveTextContent(
    'Found',
  );
});

it('deletes after a persistence failure without prompting to discard saved server work', async () => {
  vi.mocked(writeInventoryLocal).mockRejectedValue(new Error('Full'));
  const user = userEvent.setup();
  const onDeleted = vi.fn();
  setup(undefined, onDeleted);
  await user.type(await screen.findByRole('textbox', { name: 'stock-events.field-of' }), '5');
  await screen.findAllByText('stock-events.draft-failed');
  await user.click(screen.getByRole('button', { name: 'physical-inventory.delete' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.delete' }),
  );
  await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  expect(deletePhysicalInventory).toHaveBeenCalledWith('d');
});

it('allows Delete when eligibility fails while keeping Save and Submit disabled', async () => {
  const user = userEvent.setup();
  const view = setup();
  await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  vi.mocked(fetchEligibleInventoryProducts).mockRejectedValue(new Error('Failed'));
  await view.client.resetQueries({ queryKey: eligibleInventoryProductsOptions(draft).queryKey });
  await screen.findByText('physical-inventory.load-error-description');
  expect(screen.getByRole('button', { name: 'physical-inventory.delete' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'physical-inventory.save' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'stock-events.submit' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'physical-inventory.delete' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.delete' }),
  );
  await waitFor(() => expect(deletePhysicalInventory).toHaveBeenCalledWith('d'));
});

it.each([false, true])(
  'submits an inactive blank only if revealed during the session: %s',
  async (revealed) => {
    const hidden = {
      ...stock[0],
      orderable: { ...stock[0].orderable, id: 'hidden', productCode: 'Z' },
      stockOnHand: 0,
      active: false,
    };
    const allStock = [...stock, hidden];
    vi.mocked(fetchInventoryStockLines).mockResolvedValue(allStock);
    vi.mocked(fetchEligibleInventoryProducts).mockResolvedValue(allStock);
    const user = userEvent.setup();
    const view = setup({ size: 20, page: 1 }, undefined, undefined, allStock);
    const inputs = await screen.findAllByRole('textbox', { name: 'stock-events.field-of' });
    for (const input of inputs) await user.type(input, '5');
    if (revealed) {
      view.rerender(view.tree({ size: 20, page: 1, includeInactive: true }));
      await waitFor(() =>
        expect(screen.getAllByRole('textbox', { name: 'stock-events.field-of' })).toHaveLength(3),
      );
      view.rerender(view.tree({ size: 20, page: 1 }));
      await waitFor(() =>
        expect(screen.getAllByRole('textbox', { name: 'stock-events.field-of' })).toHaveLength(2),
      );
    }
    await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'stock-events.confirm' }),
    );
    await waitFor(() => expect(submitPhysicalInventory).toHaveBeenCalled());
    const submitted = vi.mocked(submitPhysicalInventory).mock.calls[0][0].lineItems;
    expect(submitted).toHaveLength(revealed ? 3 : 2);
    if (revealed) expect(submitted.find((line) => line.orderableId === 'hidden')?.quantity).toBe(0);
  },
);

it('retains saved session counts when the stock refresh fails and saves them again', async () => {
  const user = userEvent.setup();
  const view = setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '5');
  vi.mocked(fetchInventoryStockLines).mockRejectedValue(new Error('Refresh failed'));
  for (let attempt = 0; attempt < 2; attempt++) {
    await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
    );
    await waitFor(() => expect(savePhysicalInventory).toHaveBeenCalledTimes(attempt + 1));
    await waitFor(() =>
      expect(
        view.client.getQueryState(inventoryStockLinesOptions(draft).queryKey)?.fetchStatus,
      ).toBe('idle'),
    );
    await waitFor(() =>
      expect(view.client.getQueryState(inventoryStockLinesOptions(draft).queryKey)?.status).toBe(
        'error',
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveValue('5');
  }
  expect(writeInventoryLocal).toHaveBeenCalledWith(
    ...inventoryWrite(expect.objectContaining({ modified: false })),
  );
  expect(savePhysicalInventory).toHaveBeenLastCalledWith(
    expect.objectContaining({
      lineItems: expect.arrayContaining([
        expect.objectContaining({ orderableId: 'A', quantity: 5 }),
      ]),
    }),
  );
});

it('dismisses the unaccounted tooltip with Escape until the count is focused again', async () => {
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '7');
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    'physical-inventory.unaccounted-error',
  );
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  expect(input).toHaveFocus();
  await user.type(input, '0');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  await user.tab();
  await user.click(input);
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    'physical-inventory.unaccounted-error',
  );
});

it.each([false, true])(
  'submits a deactivated blank only if displayed again: %s',
  async (revealed) => {
    const allStock = [{ ...stock[0], stockOnHand: 0 }, stock[1]];
    vi.mocked(fetchInventoryStockLines).mockResolvedValue(allStock);
    vi.mocked(fetchEligibleInventoryProducts).mockResolvedValue(allStock);
    vi.mocked(readInventoryLocal).mockResolvedValue({
      draftId: 'd',
      facilityId: 'f',
      programId: 'p',
      modified: true,
      savedAt: 1,
      lines: buildInventoryLines(allStock, []).map((line) => ({ ...line, isAdded: true })),
    });
    const user = userEvent.setup();
    const view = setup({ size: 20, page: 1 }, undefined, undefined, allStock);
    await screen.findAllByRole('textbox', { name: 'stock-events.field-of' });
    await user.click(
      screen.getByRole('button', { name: 'stock-events.field-of:physical-inventory.deactivate' }),
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'physical-inventory.deactivate',
      }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole('textbox', { name: 'stock-events.field-of' })).toHaveLength(1),
    );
    await user.type(screen.getByRole('textbox', { name: 'stock-events.field-of' }), '5');
    if (revealed) {
      view.rerender(view.tree({ size: 20, page: 1, includeInactive: true }));
      await waitFor(() =>
        expect(screen.getAllByRole('textbox', { name: 'stock-events.field-of' })).toHaveLength(2),
      );
      view.rerender(view.tree({ size: 20, page: 1 }));
      await waitFor(() =>
        expect(screen.getAllByRole('textbox', { name: 'stock-events.field-of' })).toHaveLength(1),
      );
    }
    await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'stock-events.confirm' }),
    );
    await waitFor(() => expect(submitPhysicalInventory).toHaveBeenCalled());
    const submitted = vi.mocked(submitPhysicalInventory).mock.calls[0][0].lineItems;
    expect(submitted.some((line) => line.orderableId === 'A')).toBe(revealed);
  },
);

it('marks invalid product pages after Submit and clears a page as its count is fixed', async () => {
  const user = userEvent.setup();
  setup();
  const count = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
  );
  expect(screen.getByRole('button', { name: 'Page 1: Contains Invalid Rows' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Page 2: Contains Invalid Rows' })).toBeInTheDocument();
  await user.type(count, '3');
  expect(screen.getByRole('button', { name: 'Page 1: Contains Invalid Rows' })).toBeInTheDocument();
  await user.clear(count);
  await user.type(count, '5');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Page 2: Contains Invalid Rows' })).toBeInTheDocument();
});

it.each([false, true])(
  'validates an added count from 1 to 2 only after grid editing, newLot=%s',
  async (newLot) => {
    const user = userEvent.setup();
    const view = setup({ size: 10, page: 1 });
    const added = {
      orderable: { id: 'C', productCode: 'C', fullProductName: 'C', description: null },
      lot: null,
      stockOnHand: null,
    };
    view.client.setQueryData(eligibleInventoryProductsOptions(draft).queryKey, [...stock, added]);
    await screen.findAllByRole('textbox', { name: 'stock-events.field-of' });
    await user.click(screen.getByRole('button', { name: 'physical-inventory.add-product' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: 'stock-events.product' }));
    await user.click(screen.getByRole('option', { name: 'C' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'stock-events.lot-code' }));
    await user.click(
      screen.getByRole('option', {
        name: newLot ? 'physical-inventory.add-new-lot' : 'stock-events.no-lot-defined',
      }),
    );
    if (newLot)
      await user.type(
        within(dialog).getByRole('textbox', { name: 'physical-inventory.new-lot-code' }),
        'New Batch',
      );
    await user.click(within(dialog).getByRole('button', { name: 'stock-events.add' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'stock-events.field-of' }), '1');
    await user.click(within(dialog).getByRole('button', { name: 'physical-inventory.add-items' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const count = screen.getAllByRole('textbox', { name: 'stock-events.field-of' }).at(-1);
    expect(count).toHaveValue('1');
    expect(screen.queryByText('physical-inventory.unaccounted-error')).not.toBeInTheDocument();
    await user.clear(count as HTMLElement);
    await user.type(count as HTMLElement, '2');
    expect(screen.getAllByText('physical-inventory.unaccounted-error').length).toBeGreaterThan(0);
  },
);

it('hides an optional column when the rendered table exceeds its container by 15 px', async () => {
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 2000,
    height: 100,
    x: 0,
    y: 0,
    top: 0,
    right: 2000,
    bottom: 100,
    left: 0,
    toJSON: () => ({}),
  });
  const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.dataset.slot === 'table-container' ? 2000 : 0;
  });
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.dataset.slot !== 'table-container') return 0;
    return this.querySelector('[data-inventory-column="productCode"]') ? 2015 : 1999;
  });
  try {
    setup({ size: 10, page: 1 });
    await screen.findAllByRole('textbox', { name: 'stock-events.field-of' });
    await waitFor(() =>
      expect(
        screen.queryByRole('columnheader', { name: 'stock-events.product-code' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('columnheader', { name: 'physical-inventory.current-stock' }),
    ).toBeInTheDocument();
  } finally {
    bounds.mockRestore();
    client.mockRestore();
    scroll.mockRestore();
  }
});

it('keeps phone detail choices and scrolls on paging while filters stay put', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(390);
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
  const user = userEvent.setup();
  const view = setup();
  try {
    await screen.findByText('A (A)');
    expect(screen.getByText('stock-events.pack-size')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View' }));
    expect(await screen.findByText('Toggle Details')).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemcheckbox', { name: 'stock-events.product-code' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'stock-events.pack-size' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByText('stock-events.pack-size')).not.toBeInTheDocument();
    scroll.mockClear();
    await user.click(screen.getByRole('button', { name: 'Next Page' }));
    expect(view.change).toHaveBeenLastCalledWith(expect.any(Function), undefined, {
      resetScroll: false,
    });
    view.rerender(view.tree({ size: 1, page: 2 }));
    await screen.findByText('B (B)');
    const list = screen.getByText('B (B)').closest('ul');
    await waitFor(() => expect(list).toHaveFocus());
    expect(scroll.mock.contexts).toContain(list);
    expect(screen.queryByText('stock-events.pack-size')).not.toBeInTheDocument();
    scroll.mockClear();
    view.rerender(view.tree({ size: 1, page: 1, keyword: 'A' }));
    await screen.findByText('A (A)');
    expect(scroll).not.toHaveBeenCalled();
  } finally {
    localStorage.removeItem('physical-inventory.columns');
  }
});

it('keeps the device failure visible after server Save resets the saved form baseline', async () => {
  vi.mocked(writeInventoryLocal).mockRejectedValue(new Error('Full'));
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '5');
  await screen.findAllByText('stock-events.draft-failed');
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(savePhysicalInventory).toHaveBeenCalledWith(
    expect.objectContaining({
      lineItems: expect.arrayContaining([
        expect.objectContaining({ orderableId: 'A', quantity: 5 }),
      ]),
    }),
  );
  expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveValue('5');
  expect(screen.getAllByText('stock-events.draft-failed').length).toBeGreaterThan(0);
  await waitFor(() => expect(vi.mocked(useDiscardGuard).mock.lastCall?.[0]).toBe(false));
});

it('disables conflict choices while loading and explains the disabled actions', async () => {
  const { DraftConflictError } = await import('@/lib/draft-store');
  const stored = {
    draftId: 'd',
    facilityId: 'f',
    programId: 'p',
    lines: [],
    modified: true,
    savedAt: 1,
    revision: 2,
  };
  vi.mocked(writeInventoryLocal)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValue(new DraftConflictError(stored));
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await waitFor(() => expect(writeInventoryLocal).toHaveBeenCalled());
  await user.type(input, '7');
  const load = await screen.findByRole('button', { name: 'stock-events.draft-load' });
  await waitFor(() => expect(load).toHaveFocus());
  for (const name of [
    'physical-inventory.save',
    'physical-inventory.delete',
    'stock-events.submit',
  ]) {
    const button = screen.getByRole('button', { name, hidden: true });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-description', 'stock-events.draft-conflict');
  }
  const reading = Promise.withResolvers<typeof stored>();
  vi.mocked(readInventoryLocal).mockReturnValue(reading.promise);
  await user.click(load);
  expect(load).toBeDisabled();
  expect(screen.getByRole('button', { name: 'physical-inventory.keep-counts' })).toBeDisabled();
  reading.resolve(stored);
});

it('loads an adopted unmodified copy instead of rebuilding stale loader counts', async () => {
  const { DraftConflictError } = await import('@/lib/draft-store');
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await waitFor(() => expect(writeInventoryLocal).toHaveBeenCalled());
  const latest = {
    draftId: 'd',
    programId: 'p',
    facilityId: 'f',
    lines: buildInventoryLines(stock, []).map((line) => ({
      ...line,
      quantity: quantityValue('9', 10),
    })),
    modified: false,
    savedAt: 2,
    revision: 2,
  };
  vi.mocked(readInventoryLocal).mockResolvedValue(latest);
  vi.mocked(writeInventoryLocal).mockRejectedValueOnce(new DraftConflictError(latest));
  await user.type(input, '7');
  await user.click(await screen.findByRole('button', { name: 'stock-events.draft-load' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toHaveValue('9'),
  );
  expect(writeInventoryLocal).toHaveBeenCalledTimes(2);
});

it('explains unavailable reasons and Submit when disconnected before reference reads finish', async () => {
  const { fetchValidReasons } = await import('@/features/reference-data/api/api');
  vi.mocked(fetchValidReasons).mockReturnValueOnce(new Promise(() => {}));
  const user = userEvent.setup();
  const view = setup();
  view.client.removeQueries({ queryKey: eligibleInventoryProductsOptions(draft).queryKey });
  vi.mocked(fetchEligibleInventoryProducts).mockReturnValueOnce(new Promise(() => {}));
  await user.type(await screen.findByRole('textbox', { name: 'stock-events.field-of' }), '7');
  act(() => onlineManager.setOnline(false));
  expect(screen.getByRole('button', { name: 'stock-events.submit' })).toHaveAttribute(
    'aria-description',
    'offline.unavailable-description',
  );
  await user.click(screen.getByRole('button', { name: /physical-inventory.reasons/ }));
  expect(await screen.findByRole('dialog')).toHaveTextContent('offline.unavailable-description');
});

it.each([
  { failed: false, changed: true },
  { failed: true, changed: true },
  { failed: true, changed: false },
])('flushes before leaving: failed=$failed changed=$changed', async ({ failed, changed }) => {
  if (failed) vi.mocked(writeInventoryLocal).mockRejectedValue(new Error('Quota'));
  const user = userEvent.setup();
  setup();
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  if (changed) await user.type(input, '8');
  if (failed) await screen.findAllByText('stock-events.draft-failed');
  const guard = vi.mocked(useDiscardGuard).mock.lastCall?.[1];
  expect(guard?.pending).toBe(false);
  let result: boolean | undefined;
  await act(async () => {
    result = await guard?.flushBeforeLeave?.();
  });
  expect(result).toBe(!changed || !failed);
});

it('stops autosaving after its own Save pre-check archives the current counts', async () => {
  const local = await import('@/features/stock-events/lib/physical-inventory-local');
  const api = await import('@/features/stock-events/api/physical-inventory-api');
  let orphaned = false;
  vi.mocked(api.fetchPhysicalInventoryDraft).mockResolvedValueOnce(null);
  vi.mocked(local.reconcileInventoryCopies).mockImplementationOnce(async () => {
    orphaned = true;
  });
  vi.mocked(readInventoryLocal).mockImplementation(async () =>
    orphaned
      ? {
          draftId: 'd',
          facilityId: 'f',
          programId: 'p',
          lines: [],
          modified: true,
          orphaned: true,
          savedAt: 1,
        }
      : undefined,
  );
  vi.mocked(writeInventoryLocal).mockImplementation(async (value) => {
    if (orphaned)
      throw new (await import('@/lib/draft-store')).DraftConflictError({
        ...value,
        orphaned: true,
        revision: 9,
      });
    return { ...value, revision: 1 };
  });
  const user = userEvent.setup();
  setup();
  await user.type(await screen.findByRole('textbox', { name: 'stock-events.field-of' }), '12');
  await screen.findByText('stock-events.draft-saved');
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  await screen.findByText('physical-inventory.orphaned-action');
  expect(screen.queryByText('stock-events.draft-conflict-title')).not.toBeInTheDocument();
  const writes = vi.mocked(writeInventoryLocal).mock.calls.length;
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'dialog.close' }),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(writeInventoryLocal).toHaveBeenCalledTimes(writes);
  expect(screen.getByRole('textbox', { name: 'stock-events.field-of' })).toBeDisabled();
  expect(savePhysicalInventory).not.toHaveBeenCalled();
});

it('refuses Deactivate offline after its confirmation was opened', async () => {
  const error = vi.spyOn(toast, 'error');
  const user = userEvent.setup();
  const view = setup();
  view.client.setQueryData(inventoryStockLinesOptions(draft).queryKey, [
    { ...stock[0], stockOnHand: 0 },
  ]);
  await user.click(
    await screen.findByRole('button', {
      name: 'stock-events.field-of:physical-inventory.deactivate',
    }),
  );
  const confirm = within(screen.getByRole('dialog')).getByRole('button', {
    name: 'physical-inventory.deactivate',
  });
  act(() => {
    onlineManager.setOnline(false);
    confirm.click();
  });
  expect(deactivateInventoryStockCard).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(error).toHaveBeenCalledWith('physical-inventory.deactivate-error-title', {
      description: 'offline.action-description',
    }),
  );
});

it('locks counts archived by another tab without offering conflict recovery', async () => {
  const local = await vi.importActual<
    typeof import('@/features/stock-events/lib/physical-inventory-local')
  >('@/features/stock-events/lib/physical-inventory-local');
  const db = (await import('@/integrations/local-db')).getLocalDb();
  await db.table('physicalInventoryDrafts').clear();
  vi.mocked(readInventoryLocal).mockImplementation(local.readInventoryLocal);
  vi.mocked(writeInventoryLocal).mockImplementation(local.writeInventoryLocal);
  const user = userEvent.setup();
  vi.mocked(fetchEligibleInventoryProducts).mockReturnValueOnce(new Promise(() => {}));
  const view = setup();
  view.client.removeQueries({ queryKey: eligibleInventoryProductsOptions(draft).queryKey });
  render(
    <QueryClientProvider client={view.client}>
      <InventoryOrphans scope={draft} />
    </QueryClientProvider>,
  );
  const input = await screen.findByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '12');
  await screen.findByText('stock-events.draft-saved');
  await local.reconcileInventoryCopies(draft, undefined, Date.now() + 1);
  await user.type(input, '3');
  await waitFor(() => expect(input).toBeDisabled());
  expect(screen.queryByText('stock-events.draft-conflict-title')).not.toBeInTheDocument();
  expect(vi.mocked(useDiscardGuard).mock.lastCall?.[0]).toBe(false);
  const saved = await local.readInventoryLocal('d');
  expect(saved).toMatchObject({ orphaned: true, modified: true });
  const writes = vi.mocked(writeInventoryLocal).mock.calls.length;
  view.client.setQueryData(eligibleInventoryProductsOptions(draft).queryKey, [...stock]);
  await waitFor(() =>
    expect(screen.getByText('physical-inventory.orphaned-title')).toBeInTheDocument(),
  );
  expect(writeInventoryLocal).toHaveBeenCalledTimes(writes);
  expect(await local.readInventoryLocal('d')).toEqual(saved);
});

it('releases leave protection and skips a late snapshot after the Save pre-check locks counts', async () => {
  const local = await import('@/features/stock-events/lib/physical-inventory-local');
  const api = await import('@/features/stock-events/api/physical-inventory-api');
  vi.mocked(api.fetchPhysicalInventoryDraft).mockResolvedValueOnce(null);
  const { fetchValidReasons } = await import('@/features/reference-data/api/api');
  const reasons = Promise.withResolvers<never[]>();
  vi.mocked(fetchValidReasons).mockReturnValueOnce(reasons.promise);
  vi.mocked(writeInventoryLocal).mockRejectedValue(new Error('Quota'));
  vi.mocked(local.reconcileInventoryCopies).mockImplementationOnce(async () => {
    vi.mocked(readInventoryLocal).mockResolvedValue({
      draftId: 'd',
      facilityId: 'f',
      programId: 'p',
      lines: [],
      modified: true,
      orphaned: true,
      savedAt: 1,
    });
  });
  const user = userEvent.setup();
  const view = setup();
  await user.type(await screen.findByRole('textbox', { name: 'stock-events.field-of' }), '12');
  await screen.findAllByText('stock-events.draft-failed');
  expect(vi.mocked(useDiscardGuard).mock.lastCall?.[0]).toBe(true);
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  await screen.findByText('physical-inventory.orphaned-action');
  expect(vi.mocked(useDiscardGuard).mock.lastCall?.[0]).toBe(false);
  const writes = vi.mocked(writeInventoryLocal).mock.calls.length;
  await act(async () => {
    reasons.resolve([]);
    await reasons.promise;
  });
  await waitFor(() => expect(view.client.isFetching()).toBe(0));
  expect(writeInventoryLocal).toHaveBeenCalledTimes(writes);
});
