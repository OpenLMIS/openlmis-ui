import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { FormMessagesProvider } from '@/components/form/form-messages';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchTradeItemByGtin, fetchValidReasons } from '@/features/reference-data/api/api';
import { validReasonsOptions } from '@/features/reference-data/api/queries';
import { fetchEventStockCards, submitStockEvent } from '@/features/stock-events/api/api';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import {
  AdjustmentEditor,
  type AdjustmentSearch,
} from '@/features/stock-events/components/adjustment-editor';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import type { useBarcodeScan } from '@/hooks/use-barcode-scan';
import { httpError, networkError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/stock-events/api/api', () => ({
  submitStockEvent: vi.fn(),
  fetchEventStockCards: vi.fn(),
}));
vi.mock('@/components/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
vi.mock('@/lib/feature-flags', () => ({ useFlag: () => true }));
vi.mock('@/hooks/use-quantity-unit', () => ({
  useQuantityUnit: () => {
    const [unit, setUnit] = useState<'PACKS' | 'DOSES'>('DOSES');
    return { unit, setUnit, canSwitch: true };
  },
}));
let scan: Parameters<typeof useBarcodeScan>[0]['onScan'];
vi.mock('@/hooks/use-barcode-scan', () => ({
  useBarcodeScan: (options: Parameters<typeof useBarcodeScan>[0]) => {
    scan = options.onScan;
    return { status: 'ready' };
  },
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchTradeItemByGtin: vi.fn(async () => ({ id: 'trade' })),
  fetchValidReasons: vi.fn(),
}));
const i18n = createInstance();
beforeAll(() =>
  i18n.use(ICU).init({ lng: 'en', resources: { en: { translation: en } }, keySeparator: false }),
);
beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: 'ada-id' });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  localStorage.clear();
});
const card: EventStockCard = {
  id: 'card',
  stockOnHand: 50,
  orderable: {
    id: 'product',
    productCode: 'C1',
    fullProductName: 'Aspirin',
    netContent: 16,
    identifiers: { tradeItem: 'trade' },
  },
  lot: { id: 'lot', lotCode: 'LOT', expirationDate: '2019-01-30' },
};
const other: EventStockCard = {
  ...card,
  id: 'other',
  lot: { id: 'other-lot', lotCode: 'OTHER', expirationDate: null },
};
const reason = {
  id: 'lost',
  name: 'Lost',
  reasonType: 'DEBIT',
  reasonCategory: 'ADJUSTMENT',
  isFreeTextAllowed: true,
  tags: [],
};
function setup(canViewStock = true, configure?: (client: QueryClient) => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  queryClient.setQueryData(
    eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
    [card, other],
  );
  queryClient.setQueryData(
    validReasonsOptions({ program: 'program', facilityType: 'type' }).queryKey,
    [{ id: 'assignment', reason, hidden: false }],
  );
  configure?.(queryClient);
  const onSubmitted = vi.fn();
  function Page() {
    const [search, setSearch] = useState<AdjustmentSearch>({});
    return (
      <I18nextProvider i18n={i18n}>
        <FormMessagesProvider formatError={(key) => i18n.t(key, { defaultValue: key })}>
          <AdjustmentEditor
            canViewStock={canViewStock}
            facilityId="facility"
            facilityTypeId="type"
            programId="program"
            username="ada"
            isCurrentUser={() => useLoginData.getState().referenceDataUserId === 'ada-id'}
            search={search}
            onSearchChange={(update) =>
              setSearch((old) => ({
                ...old,
                ...(typeof update === 'function' ? update(old) : update),
              }))
            }
            onSubmitted={onSubmitted}
          >
            <h1>Adjustment</h1>
          </AdjustmentEditor>
        </FormMessagesProvider>
      </I18nextProvider>
    );
  }
  renderPage(<Page />, { queryClient });
  return { user: userEvent.setup(), onSubmitted, queryClient };
}
async function add(user: ReturnType<typeof userEvent.setup>, lot = 'LOT') {
  const product = await screen.findByRole('combobox', { name: 'Product' });
  await user.click(product);
  await user.click(await screen.findByRole('option', { name: 'Aspirin' }));
  await user.click(screen.getByRole('combobox', { name: 'Lot Code' }));
  await user.click(await screen.findByRole('option', { name: new RegExp(`^${lot}`) }));
  await user.click(screen.getByRole('button', { name: 'Add' }));
}
async function pickReason(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('combobox', { name: /^Reason, Aspirin/ })[0]);
  await user.click(await screen.findByRole('option', { name: 'Lost' }));
}
async function filter(user: ReturnType<typeof userEvent.setup>, keyword: string) {
  const input = await screen.findByRole('textbox', { name: 'Keywords' });
  await user.clear(input);
  await user.type(input, keyword);
  await user.keyboard('{Enter}');
}
async function validLine(user: ReturnType<typeof userEvent.setup>) {
  await add(user);
  await pickReason(user);
  await user.type(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' }), '17');
}

describe('AdjustmentEditor', () => {
  it('keeps a quantity match visible while replacing 27 with 28', async () => {
    const { user } = setup();
    await add(user);
    await user.type(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' }), '27');
    await filter(user, '27');
    const quantity = screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' });
    await user.clear(quantity);
    await user.type(quantity, '28');
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('28');
    await filter(user, '28');
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('28');
    await filter(user, '27');
    expect(await screen.findByText('No Matching Products')).toBeInTheDocument();
  });
  it('shows Keywords directly and clears the search without submitting', async () => {
    const { user } = setup();
    await add(user);
    const keywords = screen.getByRole('textbox', { name: 'Keywords' });
    await user.type(keywords, 'missing');
    expect(await screen.findByText('No Matching Products')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Search' }));
    expect(keywords).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it.each(['products', 'reasons'] as const)(
    'retries a failed %s request in the content',
    async (source) => {
      const fetch = source === 'products' ? fetchEventStockCards : fetchValidReasons;
      vi.mocked(fetch).mockRejectedValueOnce(httpError(500));
      if (source === 'products')
        vi.mocked(fetchEventStockCards).mockResolvedValueOnce([card, other]);
      else
        vi.mocked(fetchValidReasons).mockResolvedValueOnce([
          { id: 'assignment', reason, hidden: false },
        ]);
      const { user } = setup(true, (client) =>
        client.removeQueries({
          queryKey:
            source === 'products'
              ? eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey
              : validReasonsOptions({ program: 'program', facilityType: 'type' }).queryKey,
        }),
      );
      const retry = await screen.findByRole('button', { name: 'Try Again' });
      expect(retry.closest('.flex-wrap')).toBeNull();
      await user.click(retry);
      await screen.findByRole('combobox', { name: 'Product' });
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument(),
      );
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );
  it('blocks Confirm if the session owner changes before the route renders', async () => {
    const { user } = setup();
    await validLine(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('dialog');
    act(() => useLoginData.setState({ referenceDataUserId: 'other-user' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(submitStockEvent).not.toHaveBeenCalled();
  });
  it('keeps the draft through same-user session expiry and reauthentication', async () => {
    const { user } = setup();
    await validLine(user);
    act(() => useLoginData.setState({ expired: true }));
    act(() =>
      useLoginData
        .getState()
        .setLoginData({ referenceDataUserId: 'ada-id', username: 'ada', accessToken: 'new-token' }),
    );
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('17');
  });

  it('restores focus to Product after clearing the last line', async () => {
    const { user } = setup();
    await add(user);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Clear' }),
    );
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Product' })).toHaveFocus());
  });
  it.each(['manual', 'scan'])(
    'retains last-added defaults after removal for %s additions',
    async (method) => {
      const { user } = setup();
      await add(user);
      await pickReason(user);
      await user.type(
        screen.getByRole('textbox', { name: 'Reason Comments, Aspirin LOT' }),
        'Broken',
      );
      await user.click(screen.getByRole('button', { name: /^Date, Aspirin/ }));
      await user.click(await screen.findByRole('button', { name: /October 1st, 2026/ }));
      const date = screen.getByRole('button', { name: /^Date, Aspirin/ }).textContent;
      await user.click(screen.getByRole('button', { name: /^Actions, Aspirin/ }));
      await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
      if (method === 'manual') await user.click(screen.getByRole('button', { name: 'Add' }));
      else
        await act(async () => {
          await scan(
            { ok: true, gtin: '00012345678905', lotCode: 'LOT', warnings: [], unparsed: {} },
            new AbortController().signal,
          );
        });
      expect(
        await screen.findByRole('textbox', { name: 'Reason Comments, Aspirin LOT' }),
      ).toHaveValue('Broken');
      expect(screen.getByRole('combobox', { name: /^Reason, Aspirin/ })).toHaveTextContent('Lost');
      expect(screen.getByRole('button', { name: /^Date, Aspirin/ })).toHaveTextContent(date ?? '');
    },
  );
  it('drops a scan lookup that finishes while signing', async () => {
    const { user } = setup();
    await validLine(user);
    const quantity = screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' });
    let resolve!: (value: { id: string }) => void;
    vi.mocked(fetchTradeItemByGtin).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    let operation: ReturnType<typeof scan>;
    await act(async () => {
      operation = scan(
        { ok: true, gtin: '00012345678905', lotCode: 'LOT', warnings: [], unparsed: {} },
        new AbortController().signal,
      );
    });
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('dialog');
    await act(async () => {
      resolve({ id: 'trade' });
      await operation;
    });
    expect(quantity).toHaveValue('17');
  });
  it('revalidates current lines at Confirm and shows inline errors without posting', async () => {
    const { user } = setup();
    await validLine(user);
    const quantity = screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' });
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('dialog');
    act(() => fireEvent.change(quantity, { target: { value: '65' } }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(submitStockEvent).not.toHaveBeenCalled();
    expect(quantity).toHaveAttribute('aria-invalid', 'true');
    expect(
      await screen.findByText(en['stock-events.quantity-greater-than-stock-on-hand']),
    ).toBeInTheDocument();
  });

  it('copies reason, comments and date into another line, then removes it with focus on the remaining action', async () => {
    const { user } = setup();
    await add(user);
    await pickReason(user);
    expect(screen.getByRole('textbox', { name: 'Reason Comments, Aspirin LOT' }).tagName).toBe(
      'INPUT',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Reason Comments, Aspirin LOT' }),
      'Broken',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getAllByRole('combobox', { name: /^Reason, Aspirin/ })).toHaveLength(2);
    expect(screen.getAllByRole('textbox', { name: 'Reason Comments, Aspirin LOT' })[0]).toHaveValue(
      'Broken',
    );
    const dates = screen.getAllByRole('button', { name: /^Date, Aspirin/ });
    expect(dates[0]).toHaveTextContent(dates[1].textContent ?? '');
    await user.click(screen.getAllByRole('button', { name: /^Actions, Aspirin/ })[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Actions, Aspirin/ })).toHaveFocus(),
    );
  });
  it('keeps the quantity through Packs and Doses switches', async () => {
    const { user } = setup();
    await validLine(user);
    await user.click(screen.getByRole('radio', { name: 'Packs' }));
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT Packs' })).toHaveValue('1');
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT Doses' })).toHaveValue('1');
    await user.click(screen.getByRole('radio', { name: 'Doses' }));
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('17');
  });
  it('shows Arabic digit quantities correctly in the packs total', async () => {
    localStorage.setItem('adjustment-columns', JSON.stringify({ total: true }));
    const { user } = setup();
    await add(user);
    await user.type(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' }), '١٧');
    await user.click(screen.getByRole('radio', { name: 'Packs' }));
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    const totalIndex = headers.findIndex((header) => header.textContent === 'Total Quantity');
    expect(totalIndex).toBeGreaterThan(-1);
    const row = within(table).getAllByRole('row')[1];
    expect(within(row).getAllByRole('cell')[totalIndex]).toHaveTextContent('17');
  });
  it('distinguishes no matches and clears only the filtered collection', async () => {
    const { user } = setup();
    await add(user);
    await add(user, 'OTHER');
    await filter(user, 'missing');
    expect(await screen.findByText('No Matching Products')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Filter' }));
    await filter(user, 'OTHER');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(
      within(confirm).getByText('This will remove 1 product line and its quantity.'),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Clear' }));
    await user.click(await screen.findByRole('button', { name: 'Clear Filter' }));
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Quantity, Aspirin OTHER' }),
    ).not.toBeInTheDocument();
  });
  it('validates hidden rows and returns to the first invalid field', async () => {
    const { user } = setup();
    await add(user);
    act(() => {
      const addButton = screen.getByRole('button', { name: 'Add' });
      for (let index = 0; index < 10; index++) fireEvent.click(addButton);
    });
    await filter(user, 'missing');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(screen.getAllByRole('combobox', { name: /^Reason, Aspirin/ })[0]).toHaveFocus(),
    );
    expect(screen.getAllByText('This field is required').length).toBeGreaterThan(0);
    expect(submitStockEvent).not.toHaveBeenCalled();
  });
  it('confirms a signature and sends exactly one dose-based event', async () => {
    let finish!: (id: string) => void;
    vi.mocked(submitStockEvent).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { user, onSubmitted, queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await validLine(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.type(await screen.findByRole('textbox', { name: 'Signature' }), 'Ada');
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    await user.dblClick(confirm);
    expect(submitStockEvent).toHaveBeenCalledOnce();
    expect(submitStockEvent).toHaveBeenCalledWith({
      facilityId: 'facility',
      programId: 'program',
      signature: 'Ada',
      eventOrigin: 'ADJUSTMENT',
      lineItems: [
        {
          orderableId: 'product',
          lotId: 'lot',
          quantity: 17,
          occurredDate: expect.any(String),
          reasonId: 'lost',
          extraData: {},
        },
      ],
    });
    await act(async () => finish('event'));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
    for (const key of ['stockEvents', 'stockCards', 'stockCardSummaries'])
      expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: [key] }));
  });
  it.each([httpError(400, { message: 'Stock changed' }), networkError()])(
    'keeps lines after submit failure without retrying',
    async (error) => {
      vi.mocked(submitStockEvent).mockRejectedValueOnce(error);
      const { user, onSubmitted } = setup();
      await validLine(user);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await user.click(await screen.findByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('17');
      expect(
        await screen.findByText(
          error.response
            ? 'Stock changed'
            : 'Check the stock card before submitting again. The server may already have recorded this adjustment.',
        ),
      ).toBeInTheDocument();
      expect(submitStockEvent).toHaveBeenCalledOnce();
      expect(onSubmitted).not.toHaveBeenCalled();
    },
  );
  it('adds a scanned product, counts its next scan and reveals it without changing focus', async () => {
    const { user } = setup();
    await filter(user, 'missing');
    const focus = screen.getByRole('textbox', { name: 'Keywords' });
    await act(async () => focus.focus());
    const signal = new AbortController().signal;
    const parsed = {
      ok: true as const,
      gtin: '00012345678905',
      lotCode: 'LOT',
      warnings: [],
      unparsed: {},
    };
    await act(async () => {
      await scan(parsed, signal);
    });
    expect(await screen.findByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('16');
    await act(async () => {
      await scan(parsed, signal);
    });
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('32');
    expect(focus).toHaveFocus();
  });
  it('goes to page two for an invalid line that the keyword hides', async () => {
    const { user } = setup();
    await add(user);
    await pickReason(user);
    act(() => {
      const addButton = screen.getByRole('button', { name: 'Add' });
      for (let index = 0; index < 10; index++) fireEvent.click(addButton);
    });
    act(() => {
      for (const input of screen.getAllByRole('textbox', { name: 'Quantity, Aspirin LOT' }))
        fireEvent.change(input, { target: { value: '1' } });
    });
    await filter(user, 'missing');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveFocus(),
    );
    expect(screen.getAllByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveLength(1);
  });
  it('confirms an expiry mismatch once per draft and ignores aborted scans', async () => {
    setup();
    await screen.findByRole('combobox', { name: 'Product' });
    const parsed = {
      ok: true as const,
      gtin: '00012345678905',
      lotCode: 'LOT',
      expiry: '2027-01-01',
      warnings: [],
      unparsed: {},
    };
    const controller = new AbortController();
    controller.abort();
    await act(async () => {
      await scan(parsed, controller.signal);
    });
    expect(
      screen.queryByRole('textbox', { name: 'Quantity, Aspirin LOT' }),
    ).not.toBeInTheDocument();
    const signal = new AbortController().signal;
    let operation: ReturnType<typeof scan>;
    await act(async () => {
      operation = scan(parsed, signal);
    });
    const prompt = await screen.findByRole('alertdialog');
    await userEvent.click(within(prompt).getByRole('button', { name: 'Confirm' }));
    await act(async () => {
      await operation;
    });
    expect(await screen.findByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('16');
    await act(async () => {
      await scan(parsed, signal);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('32');
  });
  it('explains missing stock view access and offers no picker', async () => {
    setup(false);
    expect(
      await screen.findByText(
        'You need permission to view stock cards for this facility and program before you can add products.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Product' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });
});
