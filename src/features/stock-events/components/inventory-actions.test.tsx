import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import type { ComponentProps } from 'react';
import { toast } from 'sonner';
import { beforeEach, expect, it, vi } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import { WorkspaceSlots } from '@/components/workspace-tabs';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  createPhysicalInventoryLot,
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
import {
  clearInventoryLocal,
  readInventoryLocal,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { addedInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';
import { DraftConflictError } from '@/lib/draft-store';

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
vi.mock('@/features/stock-events/lib/physical-inventory-local', async (original) => ({
  ...(await original<typeof import('@/features/stock-events/lib/physical-inventory-local')>()),
  reconcileInventoryCopies: vi.fn().mockResolvedValue(undefined),
  readInventoryLocal: vi.fn(),
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
  vi.mocked(fetchPhysicalInventoryDraft).mockResolvedValue(draft);
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'user', username: 'user', accessToken: 'token' });
  vi.mocked(readInventoryLocal).mockResolvedValue(undefined);
  vi.mocked(clearInventoryLocal).mockResolvedValue(undefined);
  vi.mocked(writeInventoryLocal).mockResolvedValue(undefined);
  vi.mocked(savePhysicalInventory).mockResolvedValue(undefined);
  vi.mocked(deletePhysicalInventory).mockResolvedValue(undefined);
  vi.mocked(submitPhysicalInventory).mockResolvedValue(undefined);
});
function setup(overrides: Partial<ComponentProps<typeof InventoryActions>> = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { networkMode: 'always' },
    },
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
          clearLocal={clearInventoryLocal}
          writeLocal={writeInventoryLocal}
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
it('checks the server once for Save and caches the accepted draft without another GET', async () => {
  const user = userEvent.setup();
  const { client } = setup();
  const scope = { facilityId: draft.facilityId, programId: draft.programId };
  const options = physicalInventoryDraftOptions(scope);
  client.setQueryData(options.queryKey, draft);
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(fetchPhysicalInventoryDraft).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(options.queryKey)).toMatchObject({
    id: 'd',
    lineItems: [expect.objectContaining({ orderableId: 'p', quantity: 5 })],
  });
  unsubscribe();
});
async function confirmAction(action: 'save' | 'delete' | 'submit') {
  const user = userEvent.setup();
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
}
it('reports a successful server Save separately from a device write failure', async () => {
  vi.mocked(writeInventoryLocal).mockRejectedValueOnce(new Error('Full'));
  const { onSaved } = setup();
  await confirmAction('save');
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(toast.error).not.toHaveBeenCalled();
  expect(toast.success).toHaveBeenCalledWith('physical-inventory.saved-title', {
    description: 'physical-inventory.saved-description',
  });
});
it.each(['delete', 'submit'] as const)(
  'reports successful server %s separately from device cleanup failure',
  async (action) => {
    vi.mocked(clearInventoryLocal).mockRejectedValueOnce(new Error('Full'));
    const { onSaved, onDeleted } = setup();
    await confirmAction(action);
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

it('saves with created lot ids even when their device write fails', async () => {
  const user = userEvent.setup();
  let live = [
    addedInventoryLine(stock, quantityValue('0'), {
      clientId: 'new',
      lotCode: 'NEW',
      expirationDate: null,
      tradeItemId: 'trade',
    }),
  ];
  const created = { id: 'created', lotCode: 'NEW', expirationDate: null };
  vi.mocked(createPhysicalInventoryLot).mockResolvedValue(created);
  vi.mocked(writeInventoryLocal)
    .mockRejectedValueOnce(new Error('Full'))
    .mockResolvedValue(undefined);
  const { onSaved } = setup({
    getLines: () => live,
    displayed: live,
    onLots: (next) => {
      live = next;
    },
  });
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(live[0].lot).toEqual(created);
  expect(live[0].newLot).toBeUndefined();
  expect(createPhysicalInventoryLot).toHaveBeenCalledOnce();
  expect(savePhysicalInventory).toHaveBeenCalledWith(
    expect.objectContaining({
      lineItems: [expect.objectContaining({ orderableId: 'p', lotId: 'created', quantity: 0 })],
    }),
  );
});

it.each([
  ...(['save', 'delete'] as const).map((action) => [action, 'conflicted'] as const),
  ...(['save', 'delete'] as const).map((action) => [action, 'orphaned'] as const),
])('keeps counts and stops %s when the device copy is %s', async (action, cause) => {
  const user = userEvent.setup();
  const flush =
    cause === 'conflicted'
      ? vi.fn().mockRejectedValue(new DraftConflictError(undefined))
      : vi.fn().mockResolvedValue(undefined);
  if (cause === 'orphaned')
    vi.mocked(readInventoryLocal).mockResolvedValueOnce({
      draftId: 'd',
      programId: 'p',
      facilityId: 'f',
      lines: [],
      modified: true,
      orphaned: true,
      savedAt: 1,
    });
  const { onDeleted } = setup({ flush });
  await user.click(
    screen.getByRole('button', {
      name: `physical-inventory.${action}`,
    }),
  );
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: `physical-inventory.${action}`,
    }),
  );
  await screen.findByRole('alertdialog');
  expect(onDeleted).not.toHaveBeenCalled();
  expect(deletePhysicalInventory).not.toHaveBeenCalled();
  expect(savePhysicalInventory).not.toHaveBeenCalled();
  expect(submitPhysicalInventory).not.toHaveBeenCalled();
  expect(clearInventoryLocal).not.toHaveBeenCalled();
  expect(flush).toHaveBeenCalledOnce();
});

it.each(['save', 'delete', 'submit'] as const)(
  'allows server %s despite a persistence failure or unreadable device copy',
  async (action) => {
    const user = userEvent.setup();
    vi.mocked(readInventoryLocal).mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    const { onSaved, onDeleted } = setup({ flush: vi.fn().mockRejectedValue(new Error('Quota')) });
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
  },
);

it.each([false, true])(
  'validates offline counts before asking for a connection: complete=%s',
  async (complete) => {
    onlineManager.setOnline(false);
    const onInvalid = vi.fn();
    const local = complete
      ? lines
      : lines.map((line) => ({ ...line, quantity: quantityValue('', 1) }));
    setup({ getLines: () => local, displayed: local, onInvalid });
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'physical-inventory.save' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'physical-inventory.delete' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
    const dialog = screen.getByRole('alertdialog');
    expect(
      within(dialog).getByText(
        complete ? 'physical-inventory.submit-offline-title' : 'physical-inventory.invalid-title',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'dialog.close' }));
    if (!complete) await waitFor(() => expect(onInvalid).toHaveBeenCalledWith(local));
    expect(savePhysicalInventory).not.toHaveBeenCalled();
    expect(submitPhysicalInventory).not.toHaveBeenCalled();
    expect(createPhysicalInventoryLot).not.toHaveBeenCalled();
    expect(fetchEligibleInventoryProducts).not.toHaveBeenCalled();
  },
);

it('stops Save when the connection is lost while eligible products are resolving', async () => {
  const pending = Promise.withResolvers<(typeof stock)[]>();
  const { client } = setup();
  client.removeQueries({ queryKey: eligibleInventoryProductsOptions(draft).queryKey });
  vi.mocked(fetchEligibleInventoryProducts).mockReturnValueOnce(pending.promise);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  await waitFor(() => expect(fetchEligibleInventoryProducts).toHaveBeenCalled());
  act(() => onlineManager.setOnline(false));
  await act(async () => pending.resolve([stock]));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('physical-inventory.save-error-title', {
      description: 'offline.action-description',
    }),
  );
  expect(savePhysicalInventory).not.toHaveBeenCalled();
  expect(submitPhysicalInventory).not.toHaveBeenCalled();
  expect(createPhysicalInventoryLot).not.toHaveBeenCalled();
});

it.each(['save', 'delete', 'submit'] as const)(
  'explains lost connection when confirming an already open %s dialog',
  async (action) => {
    setup();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', {
        name: action === 'submit' ? 'stock-events.submit' : `physical-inventory.${action}`,
      }),
    );
    act(() => onlineManager.setOnline(false));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: action === 'submit' ? 'stock-events.confirm' : `physical-inventory.${action}`,
      }),
    );
    if (action === 'submit') {
      expect(await screen.findByRole('alertdialog')).toHaveTextContent(
        'physical-inventory.submit-offline-description',
      );
    } else {
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(`physical-inventory.${action}-error-title`, {
          description: 'offline.action-description',
        }),
      );
    }
    expect(savePhysicalInventory).not.toHaveBeenCalled();
    expect(deletePhysicalInventory).not.toHaveBeenCalled();
    expect(submitPhysicalInventory).not.toHaveBeenCalled();
  },
);

it.each(['save', 'submit'] as const)(
  'refuses %s when the server draft was deleted while this editor was offline',
  async (action) => {
    const user = userEvent.setup();
    vi.mocked(fetchPhysicalInventoryDraft).mockResolvedValueOnce(null);
    vi.mocked(readInventoryLocal).mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      draftId: 'd',
      programId: 'p',
      facilityId: 'f',
      lines: [],
      modified: true,
      orphaned: true,
      savedAt: 1,
    });
    setup();
    await user.click(
      screen.getByRole('button', {
        name: action === 'submit' ? 'stock-events.submit' : 'physical-inventory.save',
      }),
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: action === 'submit' ? 'stock-events.confirm' : 'physical-inventory.save',
      }),
    );
    await waitFor(() => expect(fetchPhysicalInventoryDraft).toHaveBeenCalled());
    expect(savePhysicalInventory).not.toHaveBeenCalled();
    expect(submitPhysicalInventory).not.toHaveBeenCalled();
    expect(createPhysicalInventoryLot).not.toHaveBeenCalled();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'physical-inventory.orphaned-action',
    );
  },
);

it('does not claim earlier counts were kept when reconciliation removed an untouched copy', async () => {
  vi.mocked(fetchPhysicalInventoryDraft).mockResolvedValueOnce(null);
  vi.mocked(readInventoryLocal).mockResolvedValue(undefined);
  setup();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'physical-inventory.save' }),
  );
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    'physical-inventory.no-draft-description',
  );
  expect(screen.queryByText('physical-inventory.orphaned-action')).not.toBeInTheDocument();
});
