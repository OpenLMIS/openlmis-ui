import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import type { ComponentProps } from 'react';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import { beforeEach, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { quantityValue } from '@/components/form/quantity-value';
import { WorkspaceSlots } from '@/components/workspace/workspace-tabs';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchLotsByTradeItemAndCode } from '@/features/reference-data/api/api';
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
  reconcileInventoryCopies,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { addedInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';
import { DraftConflictError } from '@/lib/draft-store';
import { httpError } from '@/test-utils/http-error';

vi.mock('@/features/reference-data/api/api', () => ({
  fetchLotsByTradeItemAndCode: vi.fn(),
}));
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
  vi.mocked(fetchLotsByTradeItemAndCode).mockResolvedValue([]);
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
function setup(
  overrides: Partial<ComponentProps<typeof InventoryActions>> = {},
  i18n?: ReturnType<typeof createInstance>,
) {
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
  const actions = (
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
    </QueryClientProvider>
  );
  render(i18n ? <I18nextProvider i18n={i18n}>{actions}</I18nextProvider> : actions);
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
function confirmationDialog(action: 'save' | 'delete' | 'submit') {
  const name = action === 'submit' ? 'physical-inventory.occurred-title' : undefined;
  return screen.getByRole('dialog', { name });
}

async function confirmAction(
  action: 'save' | 'delete' | 'submit',
  actionLabel = `physical-inventory.${action}`,
) {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', {
      name: action === 'submit' ? 'stock-events.submit' : actionLabel,
    }),
  );
  await user.click(
    within(confirmationDialog(action)).getByRole('button', {
      name: action === 'submit' ? 'stock-events.confirm' : actionLabel,
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
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(submitPhysicalInventory).mockRejectedValue(new AxiosError('Network'));
  setup();
  await user.click(screen.getByRole('button', { name: 'stock-events.submit' }));
  await user.click(
    within(confirmationDialog('submit')).getByRole('button', { name: 'stock-events.confirm' }),
  );
  const alert = await screen.findByRole('alertdialog');
  expect(alert).toHaveTextContent('physical-inventory.unknown-outcome-description');
  expect(log).not.toHaveBeenCalled();
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
      within(confirmationDialog(action)).getByRole('button', {
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
it.each([
  ['save', 'physical-inventory.save-error-description'],
  ['save', 'physical-inventory.save-error-keep-open'],
  ['delete', 'error.description'],
  ['submit', 'error.description'],
] as const)('opens an alert for a %s server failure', async (type, description) => {
  const user = userEvent.setup();
  const request =
    type === 'save'
      ? savePhysicalInventory
      : type === 'delete'
        ? deletePhysicalInventory
        : submitPhysicalInventory;
  vi.mocked(request).mockRejectedValueOnce(new Error('Failed'));
  setup(
    description === 'physical-inventory.save-error-keep-open'
      ? { flush: vi.fn().mockRejectedValueOnce(new Error('Quota exceeded')) }
      : {},
  );
  await user.click(
    screen.getByRole('button', {
      name: type === 'submit' ? 'stock-events.submit' : `physical-inventory.${type}`,
    }),
  );
  await user.click(
    within(confirmationDialog(type)).getByRole('button', {
      name: type === 'submit' ? 'stock-events.confirm' : `physical-inventory.${type}`,
    }),
  );
  const alert = await screen.findByRole('alertdialog');
  expect(alert).toHaveTextContent(description);
  expect(toast.error).not.toHaveBeenCalled();
  await user.click(within(alert).getByRole('button', { name: 'dialog.close' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'stock-events.submit' })).toHaveFocus(),
  );
});

it.each([
  ['get', false, fetchPhysicalInventoryDraft, 'physical-inventory.save-error-keep-open'],
  ['put', false, savePhysicalInventory, 'physical-inventory.save-timeout-keep-open'],
  ['get', true, fetchPhysicalInventoryDraft, 'api-error.timeout-read'],
  ['put', true, savePhysicalInventory, 'api-error.timeout-write'],
] as const)(
  'describes a %s timeout after a local flush (succeeded: %s)',
  async (method, flushed, request, description) => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(request).mockRejectedValueOnce(
      new AxiosError('Timed out', AxiosError.ECONNABORTED, { method, headers: new AxiosHeaders() }),
    );
    setup(flushed ? {} : { flush: vi.fn().mockRejectedValueOnce(new Error('Quota exceeded')) });

    await user.click(screen.getByRole('button', { name: 'physical-inventory.save' }));
    await user.click(
      within(confirmationDialog('save')).getByRole('button', { name: 'physical-inventory.save' }),
    );

    const alert = await screen.findByRole('alertdialog');
    expect(alert).toHaveTextContent(description);
  },
);

async function englishTranslations() {
  const i18n = createInstance().use(ICU);
  await i18n.init({
    lng: 'en',
    keySeparator: false,
    nsSeparator: false,
    resources: { en: { translation: en } },
  });
  return i18n;
}

it.each([
  [
    'duplicate lot',
    createPhysicalInventoryLot,
    httpError(400, { messageKey: 'referenceData.error.lot.lotCode.mustBeUnique' }),
    'Lot code must be unique: NEW.',
  ],
  [
    'lot write timeout',
    createPhysicalInventoryLot,
    new AxiosError('Timed out', AxiosError.ECONNABORTED, {
      method: 'post',
      headers: new AxiosHeaders(),
    }),
    'Could not create lots: NEW. The server did not answer in time. Keep this page open and save again. Lots that were already created will be reused.',
  ],
  [
    'unkeyed lot failure',
    createPhysicalInventoryLot,
    httpError(500, { message: 'Internal error' }),
    'Could not create lots: NEW. Keep this page open and try saving again.',
  ],
  [
    'keyed lot refusal',
    createPhysicalInventoryLot,
    httpError(400, { messageKey: 'lot.refused', message: 'This trade item is inactive.' }),
    'Could not create lots: NEW. This trade item is inactive. Your latest counts are only on this page, so keep it open.',
  ],
  [
    'submitted inventory',
    savePhysicalInventory,
    httpError(400, { messageKey: 'stockmanagement.error.physicalInventory.isSubmitted' }),
    'This physical inventory has already been submitted and cannot be changed. Your latest counts are only on this page, so keep it open.',
  ],
  [
    'untranslated inventory refusal',
    savePhysicalInventory,
    httpError(400, { messageKey: 'inventory.refused', message: 'The server refused the counts' }),
    'The server refused the counts. Your latest counts are only on this page, so keep it open.',
  ],
] as const)(
  'shows safe Save feedback after a failed device flush (%s)',
  async (_, request, error, description) => {
    const i18n = await englishTranslations();
    vi.mocked(request).mockRejectedValueOnce(error);
    const pending =
      request === createPhysicalInventoryLot
        ? [
            addedInventoryLine(stock, quantityValue('0'), {
              clientId: 'new',
              lotCode: 'NEW',
              expirationDate: null,
              tradeItemId: 'trade',
            }),
          ]
        : lines;
    setup(
      {
        displayed: pending,
        getLines: () => pending,
        flush: vi.fn().mockRejectedValueOnce(new Error('Quota exceeded')),
      },
      i18n,
    );

    await confirmAction('save', en['physical-inventory.save']);

    const alert = await screen.findByRole('alertdialog');
    expect(alert).toHaveTextContent(description);
    expect(alert).not.toHaveTextContent(en['api-error.timeout-write']);
    expect(alert).not.toHaveTextContent(en['physical-inventory.save-error-description']);
  },
);

it('uses normal Save feedback once a later device write preserves the counts', async () => {
  const pending = [
    addedInventoryLine(stock, quantityValue('7'), {
      clientId: 'new',
      lotCode: 'NEW',
      expirationDate: null,
      tradeItemId: 'trade',
    }),
  ];
  vi.mocked(createPhysicalInventoryLot).mockResolvedValueOnce({
    id: 'created',
    lotCode: 'NEW',
    expirationDate: null,
  });
  vi.mocked(savePhysicalInventory).mockRejectedValueOnce(
    httpError(400, { messageKey: 'stockmanagement.error.physicalInventory.isSubmitted' }),
  );
  setup(
    {
      displayed: pending,
      getLines: () => pending,
      flush: vi.fn().mockRejectedValueOnce(new Error('Quota exceeded')),
    },
    await englishTranslations(),
  );

  await confirmAction('save', en['physical-inventory.save']);

  const alert = await screen.findByRole('alertdialog');
  expect(alert).toHaveAccessibleDescription(
    en['api-error.stockmanagement.error.physicalInventory.isSubmitted'],
  );
  expect(writeInventoryLocal).toHaveBeenCalledWith(
    expect.objectContaining({
      lines: [expect.objectContaining({ key: 'p|created', quantity: quantityValue('7') })],
    }),
  );
});

it('reuses a lot created by a timed-out POST and saves the entered count', async () => {
  const pending = [
    addedInventoryLine(stock, quantityValue('7'), {
      clientId: 'new',
      lotCode: 'NEW',
      expirationDate: '2030-01-30',
      tradeItemId: 'trade',
    }),
  ];
  vi.mocked(fetchLotsByTradeItemAndCode)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { id: 'partial', lotCode: 'NEW-2', expirationDate: '2030-01-30', tradeItemId: 'trade' },
      { id: 'other-item', lotCode: 'NEW', expirationDate: '2030-01-30', tradeItemId: 'other' },
      { id: 'created', lotCode: 'new', expirationDate: '2030-01-30', tradeItemId: 'trade' },
    ]);
  vi.mocked(createPhysicalInventoryLot).mockRejectedValueOnce(
    new AxiosError('Timed out', AxiosError.ECONNABORTED, {
      method: 'post',
      headers: new AxiosHeaders(),
    }),
  );
  setup(
    {
      displayed: pending,
      getLines: () => pending,
      flush: vi.fn().mockRejectedValueOnce(new Error('Quota exceeded')),
    },
    await englishTranslations(),
  );

  await confirmAction('save', en['physical-inventory.save']);

  const alert = await screen.findByRole('alertdialog');
  expect(alert).toHaveTextContent(en['physical-inventory.lot-timeout-keep-open']);
  expect(savePhysicalInventory).not.toHaveBeenCalled();
  await userEvent.click(within(alert).getByRole('button', { name: en['dialog.close'] }));
  await confirmAction('save', en['physical-inventory.save']);

  await waitFor(() =>
    expect(savePhysicalInventory).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [expect.objectContaining({ lotId: 'created', quantity: 7 })],
      }),
    ),
  );
  expect(fetchLotsByTradeItemAndCode).toHaveBeenNthCalledWith(1, 'trade', 'NEW');
  expect(fetchLotsByTradeItemAndCode).toHaveBeenNthCalledWith(2, 'trade', 'NEW');
  expect(createPhysicalInventoryLot).toHaveBeenCalledOnce();
});

it('explains an orphaned draft after a failed device flush with its earlier device counts', async () => {
  vi.mocked(fetchPhysicalInventoryDraft).mockResolvedValueOnce(null);
  vi.mocked(readInventoryLocal).mockResolvedValueOnce(undefined).mockResolvedValueOnce({
    draftId: 'd',
    facilityId: 'f',
    programId: 'p',
    lines,
    modified: true,
    orphaned: true,
    savedAt: 1,
  });
  setup({ flush: vi.fn().mockRejectedValueOnce(new Error('Quota exceeded')) });

  await confirmAction('save');

  const alert = await screen.findByRole('alertdialog');
  expect(alert).toHaveTextContent('physical-inventory.orphaned-action');
  expect(alert).not.toHaveTextContent('physical-inventory.save-error-keep-open');
  expect(savePhysicalInventory).not.toHaveBeenCalled();
});

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
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
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
  expect(log).not.toHaveBeenCalled();
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
      within(confirmationDialog(action)).getByRole('button', {
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
      within(confirmationDialog(action)).getByRole('button', {
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
      within(confirmationDialog(action)).getByRole('button', {
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

it('reports retained modified counts even if marking them orphaned fails', async () => {
  vi.mocked(fetchPhysicalInventoryDraft).mockResolvedValueOnce(null);
  vi.mocked(reconcileInventoryCopies).mockRejectedValueOnce(new Error('Device write failed'));
  vi.mocked(readInventoryLocal).mockResolvedValue({
    draftId: 'd',
    facilityId: 'f',
    programId: 'p',
    lines: [],
    modified: true,
    savedAt: 1,
  });
  const onOrphaned = vi.fn();
  setup({ onOrphaned });
  await confirmAction('save');
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    'physical-inventory.orphaned-action',
  );
  expect(onOrphaned).toHaveBeenCalledOnce();
  expect(savePhysicalInventory).not.toHaveBeenCalled();
});

it('does not claim an untouched orphaned copy contains earlier counts', async () => {
  vi.mocked(fetchPhysicalInventoryDraft).mockResolvedValueOnce(null);
  vi.mocked(readInventoryLocal).mockResolvedValueOnce(undefined).mockResolvedValueOnce({
    draftId: 'd',
    facilityId: 'f',
    programId: 'p',
    lines: [],
    modified: false,
    orphaned: true,
    savedAt: 1,
  });
  setup();
  await confirmAction('save');
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    'physical-inventory.no-draft-description',
  );
  expect(screen.queryByText('physical-inventory.orphaned-action')).not.toBeInTheDocument();
});
