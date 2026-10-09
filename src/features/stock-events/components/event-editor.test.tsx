import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createBrowserHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import fr from '@/../public/locales/fr.json';
import { formatDateValue } from '@/components/form/date-value';
import { FormMessagesProvider } from '@/components/form/form-messages';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchTradeItemByGtin,
  fetchValidAssignments,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import {
  validDestinationsOptions,
  validReasonsOptions,
} from '@/features/reference-data/api/queries';
import { fetchEventStockCards, submitStockEvent } from '@/features/stock-events/api/api';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import { EventEditor, type EventSearch } from '@/features/stock-events/components/event-editor';
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import type { useBarcodeScan } from '@/hooks/use-barcode-scan';
import { whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { httpError, networkError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
let scanningEnabled = false;
let scan: Parameters<typeof useBarcodeScan>[0]['onScan'];
vi.mock('@/hooks/use-barcode-scan', () => ({
  useBarcodeScan: (options: Parameters<typeof useBarcodeScan>[0]) => {
    scan = options.onScan;
    scanningEnabled = options.enabled;
    return { status: 'ready' };
  },
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchTradeItemByGtin: vi.fn(async () => ({ id: 'trade' })),
  fetchValidReasons: vi.fn(),
  fetchValidAssignments: vi.fn(),
}));
const destinations = [
  {
    id: 'destination',
    name: 'CHW',
    programId: 'program',
    facilityTypeId: 'type',
    node: { id: 'node', referenceId: 'org', refDataFacility: false },
    isFreeTextAllowed: true,
    geoLevelAffinityId: null,
  },
  {
    id: 'hospital',
    name: 'Hospital',
    programId: 'program',
    facilityTypeId: 'type',
    node: { id: 'hospital-node', referenceId: 'facility', refDataFacility: true },
    isFreeTextAllowed: false,
    geoLevelAffinityId: null,
  },
];
const i18n = createInstance();
beforeAll(() =>
  i18n.use(ICU).init({
    lng: 'en',
    resources: { en: { translation: en }, fr: { translation: fr } },
    keySeparator: false,
  }),
);
beforeEach(async () => {
  await i18n.changeLanguage('en');
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
function setup(
  canViewStock = true,
  configure?: (client: QueryClient) => void,
  defaultReasonId?: string,
  browserHistory = false,
  kind: ConfiguredEventKind = 'adjustment',
) {
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
  queryClient.setQueryData(
    validDestinationsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
    destinations,
  );
  configure?.(queryClient);
  const onSubmitted = vi.fn();
  let navigateSearch!: (search: EventSearch) => void;
  let latestSearch: EventSearch;
  function Page() {
    const [search, setSearch] = useState<EventSearch>({});
    navigateSearch = setSearch;
    latestSearch = search;
    return (
      <I18nextProvider i18n={i18n}>
        <FormMessagesProvider formatError={(key) => i18n.t(key, { defaultValue: key })}>
          <EventEditor
            kind={kind}
            defaultReasonId={defaultReasonId}
            canViewStock={canViewStock}
            facilityId="facility"
            facilityTypeId="type"
            programId="program"
            username="ada"
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
          </EventEditor>
        </FormMessagesProvider>
      </I18nextProvider>
    );
  }
  const router = browserHistory
    ? createRouter({
        routeTree: createRootRoute({ component: Page }),
        history: createBrowserHistory(),
      })
    : undefined;
  if (router)
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  else renderPage(<Page />, { queryClient });
  return {
    router,
    user: userEvent.setup(),
    onSubmitted,
    queryClient,
    navigateSearch: (next: EventSearch) => navigateSearch(next),
    getSearch: () => latestSearch,
  };
}
async function add(user: ReturnType<typeof userEvent.setup>, lot = 'LOT') {
  const product = await screen.findByRole('combobox', { name: 'Product' });
  await user.click(product);
  await user.click(await screen.findByRole('option', { name: 'Aspirin' }));
  const picker = screen.queryByRole('combobox', { name: 'Lot Code' });
  if (picker) {
    await user.click(picker);
    await user.click(await screen.findByRole('option', { name: new RegExp(`^${lot}`) }));
  }
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

describe('EventEditor', () => {
  it('reveals a cached hidden line when scanning makes its quantity match the keyword', async () => {
    const { user } = setup();
    await add(user);
    await user.type(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' }), '11');
    await add(user, 'OTHER');
    await user.type(screen.getByRole('textbox', { name: 'Quantity, Aspirin OTHER' }), '27');
    await filter(user, '27');
    expect(screen.queryByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toBeNull();
    const keywords = screen.getByRole('textbox', { name: 'Keywords' });
    await act(async () => keywords.focus());
    await act(async () => {
      await scan(
        { ok: true, gtin: '00012345678905', lotCode: 'LOT', warnings: [], unparsed: {} },
        new AbortController().signal,
      );
    });
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('27');
    expect(keywords).toHaveFocus();
  });

  it('cancels pending typing when Back restores the same keyword on page one', async () => {
    const { user, navigateSearch, getSearch } = setup();
    await add(user);
    act(() => {
      for (let index = 0; index < 10; index++)
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
      navigateSearch({ keyword: 'Aspirin', page: 2 });
    });
    const keywords = screen.getByRole('textbox', { name: 'Keywords' });
    vi.useFakeTimers();
    try {
      fireEvent.change(keywords, { target: { value: 'No Lot Defined' } });
      act(() => navigateSearch({ keyword: 'Aspirin' }));
      act(() => vi.advanceTimersByTime(650));
      expect(getSearch()).toEqual({ keyword: 'Aspirin' });
      expect(keywords).toHaveValue('Aspirin');
      expect(screen.getAllByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveLength(10);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['en', 'fr'] as const)(
    'refreshes cached no-lot matches for a %s keyword on language changes',
    async (language) => {
      const { user } = setup(true, (client) =>
        client.setQueryData(
          eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
          [card, { ...other, lot: null }],
        ),
      );
      await add(user, 'No Lot Defined');
      await filter(user, i18n.getFixedT(language)('stock-events.no-lot-defined'));
      expect(screen.queryAllByRole('textbox', { name: /Aspirin/ })).toHaveLength(
        language === 'en' ? 1 : 0,
      );
      await act(async () => {
        await i18n.changeLanguage('fr');
      });
      expect(screen.queryAllByRole('textbox', { name: /Aspirin/ })).toHaveLength(
        language === 'fr' ? 1 : 0,
      );
    },
  );

  it.each(['en', 'fr'] as const)(
    'refreshes cached displayed-date matches for a %s keyword on language changes',
    async (language) => {
      const { user } = setup();
      await add(user);
      await filter(user, formatDateValue('2019-01-30', language));
      expect(screen.queryAllByRole('textbox', { name: /Aspirin/ })).toHaveLength(
        language === 'en' ? 1 : 0,
      );
      await act(async () => {
        await i18n.changeLanguage('fr');
      });
      expect(screen.queryAllByRole('textbox', { name: /Aspirin/ })).toHaveLength(
        language === 'fr' ? 1 : 0,
      );
    },
  );

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
  it('blocks a retained Confirm after switching away and back to the draft owner', async () => {
    const { user } = setup();
    await validLine(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('dialog');
    act(() => {
      useLoginData.setState({ referenceDataUserId: 'other-user' });
      useLoginData.setState({ referenceDataUserId: 'ada-id' });
    });
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(submitStockEvent).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
  it.each(['success', 'failure'])(
    'ignores a submit %s that finishes after switching user',
    async (outcome) => {
      let finish!: () => void;
      vi.mocked(submitStockEvent).mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finish = () => (outcome === 'success' ? resolve('event') : reject(httpError(400)));
          }),
      );
      const { user, onSubmitted, queryClient } = setup();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      await validLine(user);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await user.click(await screen.findByRole('button', { name: 'Confirm' }));
      expect(submitStockEvent).toHaveBeenCalledOnce();
      act(() => useLoginData.setState({ referenceDataUserId: 'other-user' }));
      await act(async () => finish());
      expect(onSubmitted).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    },
  );
  it('drops a scan lookup across a switch away and back to the draft owner', async () => {
    const { user } = setup();
    await validLine(user);
    let finish!: (value: { id: string }) => void;
    vi.mocked(fetchTradeItemByGtin).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    let operation: ReturnType<typeof scan>;
    await act(async () => {
      operation = scan(
        { ok: true, gtin: '00012345678905', lotCode: 'LOT', warnings: [], unparsed: {} },
        new AbortController().signal,
      );
    });
    act(() => {
      useLoginData.setState({ referenceDataUserId: 'other-user' });
      useLoginData.setState({ referenceDataUserId: 'ada-id' });
    });
    await act(async () => {
      finish({ id: 'trade' });
      await operation;
    });
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('17');
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
            : 'Check the stock card before submitting again. The server may already have recorded this stock event.',
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
  it('confirms an expiry mismatch once per batch across expiry values and editor openings and ignores aborted scans', async () => {
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
      operation = scan({ ...parsed, expiry: '2028-01-01', lotCode: 'lot' }, signal);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await act(async () => {
      await operation;
    });
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('32');
    cleanup();
    setup();
    await screen.findByRole('combobox', { name: 'Product' });
    await act(async () => {
      await scan({ ...parsed, expiry: '2029-01-01' }, signal);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Quantity, Aspirin LOT' })).toHaveValue('16');
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

it('waits for reasons before manual and scanned additions receive the default', async () => {
  let finish!: (value: { id: string; reason: typeof reason; hidden: boolean }[]) => void;
  vi.mocked(fetchValidReasons).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { user } = setup(
    true,
    (client) =>
      client.removeQueries({
        queryKey: validReasonsOptions({ program: 'program', facilityType: 'type' }).queryKey,
      }),
    'lost',
  );
  await screen.findByRole('combobox', { name: 'Product' });
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  expect(scanningEnabled).toBe(false);
  await act(async () => {
    await scan(
      { ok: true, gtin: '00012345678905', lotCode: 'LOT', warnings: [], unparsed: {} },
      new AbortController().signal,
    );
  });
  expect(fetchTradeItemByGtin).not.toHaveBeenCalled();
  await act(async () => finish([{ id: 'assignment', reason, hidden: false }]));
  await waitFor(() => expect(scanningEnabled).toBe(true));
  await add(user);
  expect(screen.getByRole('combobox', { name: /^Reason, Aspirin/ })).toHaveTextContent('Lost');
});
it.each([true, false])(
  'uses offered cards for lot and VVM columns even before matching lines, enabled %s',
  async (enabled) => {
    localStorage.setItem('adjustment-columns', JSON.stringify({ expiry: true }));
    const { user } = setup(true, (client) =>
      client.setQueryData(
        eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
        [
          { ...card, lot: null },
          {
            ...other,
            lot: enabled ? other.lot : null,
            orderable: { ...other.orderable, extraData: { useVVM: enabled ? 'true' : 'false' } },
          },
        ],
      ),
    );
    await add(user, enabled ? 'No Lot Defined' : 'Product Has No Lots');
    for (const name of ['Lot Code', 'Expiry Date', 'VVM Status']) {
      expect(!!screen.queryByRole('columnheader', { name })).toBe(enabled);
    }
  },
);
it.each(['success', 'failure'])(
  'releases reload and sign-out guards only after submit %s',
  async (outcome) => {
    if (outcome === 'success') vi.mocked(submitStockEvent).mockResolvedValueOnce('new-event');
    else vi.mocked(submitStockEvent).mockRejectedValueOnce(httpError(400));
    const { user, onSubmitted, router } = setup(true, undefined, undefined, true);
    await validLine(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const unload = new Event('beforeunload', { cancelable: true });
    fireEvent(window, unload);
    expect(unload.defaultPrevented).toBe(outcome === 'failure');
    const leave = vi.fn();
    act(() => whenLeaveAllowed(leave));
    expect(leave).toHaveBeenCalledTimes(outcome === 'success' ? 1 : 0);
    if (outcome === 'success') expect(onSubmitted).toHaveBeenCalledWith('new-event');
    else expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    router?.history.destroy();
  },
);

afterEach(() => vi.unstubAllEnvs());

it('uses Issue stock eligibility for both the picker and scan resolver and preselects its configured transfer reason', async () => {
  const zero = {
    ...card,
    id: 'zero',
    stockOnHand: 0,
    lot: { id: 'zero-lot', lotCode: 'ZERO', expirationDate: null },
  };
  const { user } = setup(
    true,
    (client) => {
      client.setQueryData(
        eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
        [card, zero, other],
      );
      client.setQueryData(
        validReasonsOptions({ program: 'program', facilityType: 'type' }).queryKey,
        [{ reason: { ...reason, reasonCategory: 'TRANSFER' }, hidden: false }],
      );
    },
    'lost',
    false,
    'issue',
  );
  await waitFor(() => expect(scanningEnabled).toBe(true));
  for (const lotCode of ['LOT', 'ZERO']) {
    let message: Awaited<ReturnType<typeof scan>>;
    await act(async () => {
      message = await scan(
        { ok: true, gtin: '00012345678905', lotCode, warnings: [], unparsed: {} },
        new AbortController().signal,
      );
    });
    expect(message).toMatchObject({ key: 'scan.lot-not-on-screen' });
  }
  expect(screen.queryByRole('textbox', { name: /^Quantity,/ })).toBeNull();
  const lotPicker = await screen.findByRole('combobox', { name: 'Lot Code' });
  await user.click(lotPicker);
  expect(await screen.findByRole('option', { name: /^OTHER/ })).toBeVisible();
  expect(screen.queryByRole('option', { name: /^LOT/ })).toBeNull();
  expect(screen.queryByRole('option', { name: /^ZERO/ })).toBeNull();
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('combobox', { name: /^Reason, Aspirin/ })).toHaveTextContent(
    'Lost',
  );
});

describe('Issue editor', () => {
  const issueSetup = (configure?: (client: QueryClient) => void) =>
    setup(
      true,
      (client) => {
        client.setQueryData(
          eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
          [other],
        );
        client.setQueryData(
          validReasonsOptions({ program: 'program', facilityType: 'type' }).queryKey,
          [
            {
              id: 'transfer',
              reason: { ...reason, name: 'Transfer Out', reasonCategory: 'TRANSFER' },
              hidden: false,
            },
          ],
        );
        configure?.(client);
      },
      undefined,
      false,
      'issue',
    );

  it('leaves Issue To blank, focuses its error, clears comments on change and clears an optional reason', async () => {
    const { user } = issueSetup();
    await add(user, 'OTHER');
    const destination = screen.getByRole('combobox', { name: 'Issue To, Aspirin OTHER' });
    expect(destination).toHaveValue('');
    expect(
      screen.queryByRole('textbox', { name: 'Destination Comments, Aspirin OTHER' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(destination).toHaveFocus());
    await user.click(destination);
    await user.click(await screen.findByRole('option', { name: 'CHW' }));
    const comments = screen.getByRole('textbox', { name: 'Destination Comments, Aspirin OTHER' });
    expect(comments).toHaveAttribute('maxlength', '255');
    await user.type(comments, 'Courier');
    await user.click(destination);
    await user.click(await screen.findByRole('option', { name: 'Hospital' }));
    expect(comments).not.toBeInTheDocument();
    await user.click(destination);
    await user.click(await screen.findByRole('option', { name: 'CHW' }));
    expect(
      screen.getByRole('textbox', { name: 'Destination Comments, Aspirin OTHER' }),
    ).toHaveValue('');
    const select = screen.getByRole('combobox', { name: 'Reason, Aspirin OTHER' });
    expect(select).not.toHaveAttribute('aria-required', 'true');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Transfer Out' }));
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Select An Option' }));
    expect(
      screen.queryByRole('textbox', { name: 'Reason Comments, Aspirin OTHER' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Issue To, Aspirin OTHER' }));
    expect(destination).toHaveValue('');
  });

  it('copies the destination comments, filters the destination name and submits its node id', async () => {
    vi.mocked(submitStockEvent).mockResolvedValue('issue-event');
    const { user, onSubmitted } = issueSetup();
    await add(user, 'OTHER');
    await user.click(screen.getByRole('combobox', { name: 'Issue To, Aspirin OTHER' }));
    await user.click(await screen.findByRole('option', { name: 'CHW' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Destination Comments, Aspirin OTHER' }),
      'Courier',
    );
    await user.type(screen.getByRole('textbox', { name: 'Quantity, Aspirin OTHER' }), '2');
    await add(user, 'OTHER');
    expect(
      screen.getAllByRole('textbox', { name: 'Destination Comments, Aspirin OTHER' })[0],
    ).toHaveValue('Courier');
    await user.type(screen.getAllByRole('textbox', { name: 'Quantity, Aspirin OTHER' })[0], '3');
    await filter(user, 'CHW');
    expect(screen.getAllByRole('textbox', { name: 'Quantity, Aspirin OTHER' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('issue-event'));
    expect(submitStockEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventOrigin: 'ISSUE',
        lineItems: expect.arrayContaining([
          expect.objectContaining({ destinationId: 'node', destinationFreeText: 'Courier' }),
        ]),
      }),
    );
  });

  it('shows no destinations and prevents additions and submission', async () => {
    issueSetup((client) =>
      client.setQueryData(
        validDestinationsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
        [],
      ),
    );
    expect(await screen.findByText('No Destinations Configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    expect(scanningEnabled).toBe(false);
  });

  it('waits for destinations before enabling Add and scanning', async () => {
    let finish!: (value: typeof destinations) => void;
    vi.mocked(fetchValidAssignments).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    issueSetup((client) =>
      client.removeQueries({
        queryKey: validDestinationsOptions({ facilityId: 'facility', programId: 'program' })
          .queryKey,
      }),
    );
    expect(await screen.findByRole('button', { name: 'Add' })).toBeDisabled();
    expect(scanningEnabled).toBe(false);
    await act(async () => finish(destinations));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled());
    expect(scanningEnabled).toBe(true);
  });

  it('retries a destination failure', async () => {
    vi.mocked(fetchValidAssignments)
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValue(destinations);
    const { user } = issueSetup((client) =>
      client.removeQueries({
        queryKey: validDestinationsOptions({ facilityId: 'facility', programId: 'program' })
          .queryKey,
      }),
    );
    expect(await screen.findByText('Could Not Load Destinations')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled());
  });
  it('keeps a refused destination lookup short and disables submission', async () => {
    vi.mocked(fetchValidAssignments).mockRejectedValueOnce(httpError(403));
    issueSetup((client) =>
      client.removeQueries({
        queryKey: validDestinationsOptions({ facilityId: 'facility', programId: 'program' })
          .queryKey,
      }),
    );
    expect(await screen.findByText(en['no-access.description'])).toBeInTheDocument();
    expect(screen.queryByText('Could Not Load Destinations')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    expect(scanningEnabled).toBe(false);
  });
});

describe('review: readiness after a failed background refetch', () => {
  it.each(['reasons', 'destinations'] as const)(
    'keeps Add, scan and Submit usable after a failed %s refetch',
    async (lookup) => {
      const { user, queryClient } = setup(
        true,
        (client) =>
          client.setQueryData(
            eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
            [other],
          ),
        undefined,
        false,
        lookup === 'destinations' ? 'issue' : 'adjustment',
      );
      await add(user, 'OTHER');
      await user.type(screen.getByRole('textbox', { name: 'Quantity, Aspirin OTHER' }), '17');
      expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
      const queryKey =
        lookup === 'reasons'
          ? validReasonsOptions({ program: 'program', facilityType: 'type' }).queryKey
          : validDestinationsOptions({ facilityId: 'facility', programId: 'program' }).queryKey;
      vi.mocked(lookup === 'reasons' ? fetchValidReasons : fetchValidAssignments).mockRejectedValue(
        httpError(500),
      );
      await act(async () => {
        await queryClient.refetchQueries({ queryKey }).catch(() => {});
      });
      await waitFor(() => expect(queryClient.getQueryState(queryKey)?.status).toBe('error'));
      expect(screen.getByRole('combobox', { name: /^Reason, Aspirin/ })).toBeInTheDocument();
      expect(screen.queryByText(en['stock-events.reasons-error-title'])).toBeNull();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
      expect(scanningEnabled).toBe(true);
    },
  );
});
