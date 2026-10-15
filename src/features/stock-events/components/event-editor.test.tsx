import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createBrowserHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import {
  act,
  cleanup,
  fireEvent,
  type RenderOptions,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import fr from '@/../public/locales/fr.json';
import { formatDateValue, formatTimestamp } from '@/components/form/date-value';
import { FormMessagesProvider } from '@/components/form/form-messages';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchApprovedProducts,
  fetchFacilityOrderableFulfills,
  fetchLotsByTradeItems,
  fetchOrderableFulfills,
  fetchOrderablesByIds,
  fetchOrderablesByTradeItems,
  fetchReasons,
  fetchTradeItemByGtin,
  fetchValidAssignments,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import {
  deploymentTimeZoneOptions,
  reasonsOptions,
  validDestinationsOptions,
  validSourcesOptions,
} from '@/features/reference-data/api/queries';
import type { Orderable } from '@/features/reference-data/lib/types';
import {
  fetchEventStockCards,
  fetchEventStockOnHand,
  submitStockEvent,
} from '@/features/stock-events/api/api';
import {
  eventStockCardsOptions,
  eventValidReasonsOptions,
} from '@/features/stock-events/api/queries';
import { EventEditor, type EventSearch } from '@/features/stock-events/components/event-editor';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import { waitForStockEventReceipt } from '@/features/stock-events/lib/stock-event-delivery';
import {
  archiveStockEventCopy,
  createStockEventContext,
  readStockEventDraft,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import { syncStockEvents } from '@/features/stock-events/lib/stock-event-sync';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import type { useBarcodeScan } from '@/hooks/use-barcode-scan';
import { whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { getLocalDb } from '@/integrations/local-db';
import { queryKeys } from '@/lib/key-factory';
import { refreshOfflineProgram } from '@/lib/offline-download-status';
import { httpError, networkError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/stock-events/lib/stock-event-delivery', () => ({
  waitForStockEventReceipt: vi.fn(async () => ({ kind: 'queued' })),
}));

vi.mock('@/lib/offline-download-status', () => ({ refreshOfflineProgram: vi.fn() }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.mock('@/lib/adjustment-bundle', async (original) => ({
  ...(await original<typeof import('@/lib/adjustment-bundle')>()),
  getAdjustmentBundle: async (filter: {
    facilityId: string;
    programId: string;
    facilityTypeId: string;
  }) => ({
    cards: await fetchEventStockCards({
      facilityId: filter.facilityId,
      programId: filter.programId,
    }),
    reasons: await fetchValidReasons({
      program: filter.programId,
      facilityType: filter.facilityTypeId,
    }),
    tradeItems: [{ id: 'trade', gtin: '00012345678905' }],
  }),
}));

vi.mock('@/features/stock-events/api/api', () => ({
  submitStockEvent: vi.fn(),
  fetchEventStockCards: vi.fn(),
  fetchEventStockOnHand: vi.fn(),
}));
vi.mock('@/components/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
vi.mock('@/lib/feature-flags', () => ({ useFlag: () => true, getFlag: () => true }));
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
  storedTimeZone: () => undefined,
  fetchReasons: vi.fn(),
  fetchTradeItemByGtin: vi.fn(async () => ({ id: 'trade' })),
  fetchValidReasons: vi.fn(),
  fetchValidAssignments: vi.fn(),
  fetchApprovedProducts: vi.fn(),
  fetchFacilityOrderableFulfills: vi.fn(),
  fetchLotsByTradeItems: vi.fn(),
  fetchOrderablesByIds: vi.fn(),
  fetchOrderablesByTradeItems: vi.fn(),
  fetchOrderableFulfills: vi.fn(),
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
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
  vi.mocked(waitForStockEventReceipt).mockReset().mockResolvedValue({ kind: 'queued' });
  scanningEnabled = false;
  vi.mocked(fetchEventStockCards).mockReset().mockResolvedValue([card, other]);
  vi.mocked(fetchValidReasons)
    .mockReset()
    .mockResolvedValue([{ id: 'assignment', reason, hidden: false }]);
  vi.mocked(fetchTradeItemByGtin).mockReset().mockResolvedValue({ id: 'trade' });
  useLoginData.setState({ referenceDataUserId: 'ada-id' });
  await getLocalDb().table('stockEventDrafts').clear();
  await getLocalDb().table('stockEventQueue').clear();
  await getLocalDb().table('stockEventSyncErrors').clear();
  await getLocalDb().table('stockEventReceipts').clear();
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
  lot: { id: 'lot', lotCode: 'LOT', expirationDate: '2099-01-30' },
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
const testBundleScope = {
  facilityId: 'facility',
  programId: 'program',
  facilityTypeId: 'type',
  scanning: true,
};
const editorStockOptions = (kind: ConfiguredEventKind = 'adjustment') =>
  eventStockCardsOptions(
    { facilityId: 'facility', programId: 'program' },
    kind === 'adjustment' ? testBundleScope : undefined,
  );
const editorReasonsOptions = (kind: ConfiguredEventKind = 'adjustment') =>
  eventValidReasonsOptions(
    { program: 'program', facilityType: 'type' },
    kind === 'adjustment' ? testBundleScope : undefined,
  );
function setup(
  canViewStock = true,
  configure?: (client: QueryClient) => void,
  {
    defaultReasonId,
    browserHistory = false,
    kind = 'adjustment',
    canManageLots = false,
    onCaughtError,
  }: {
    defaultReasonId?: string;
    browserHistory?: boolean;
    kind?: ConfiguredEventKind;
    canManageLots?: boolean;
    onCaughtError?: RenderOptions['onCaughtError'];
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  queryClient.setQueryData(editorStockOptions(kind).queryKey, [card, other]);
  queryClient.setQueryData(editorReasonsOptions(kind).queryKey, [
    { id: 'assignment', reason, hidden: false },
  ]);
  queryClient.setQueryData(
    validDestinationsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
    destinations,
  );
  queryClient.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
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
            canManageLots={canManageLots}
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
      { onCaughtError },
    );
  else renderPage(<Page />, { queryClient, onCaughtError });
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
  await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), '17');
}

async function validIssueLine(user: ReturnType<typeof userEvent.setup>) {
  await add(user);
  await user.click(screen.getByRole('combobox', { name: /^Issue To,/ }));
  await user.click(await screen.findByRole('option', { name: 'Hospital' }));
  await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), '17');
}

describe('EventEditor', () => {
  it('reveals a cached hidden line when scanning makes its quantity match the keyword', async () => {
    const { user } = setup();
    await add(user);
    await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), '11');
    await add(user, 'OTHER');
    await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin OTHER/ }), '27');
    await filter(user, '27');
    expect(screen.queryByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toBeNull();
    const keywords = screen.getByRole('textbox', { name: 'Keywords' });
    await act(async () => keywords.focus());
    await act(async () => {
      await scan(
        { ok: true, gtin: '00012345678905', lotCode: 'LOT', warnings: [], unparsed: {} },
        new AbortController().signal,
      );
    });
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('27');
    expect(keywords).toHaveFocus();
  });

  it('cancels pending typing when Back restores the same keyword on page one', async () => {
    const { user, navigateSearch, getSearch } = setup();
    await add(user);
    await act(async () => {
      for (let index = 0; index < 10; index++)
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
      navigateSearch({ keyword: 'Aspirin', page: 2 });
    });
    const keywords = screen.getByRole('textbox', { name: 'Keywords' });
    vi.useFakeTimers();
    try {
      fireEvent.change(keywords, { target: { value: 'No Lot Defined' } });
      act(() => navigateSearch({ keyword: 'Aspirin' }));
      await act(async () => vi.advanceTimersByTimeAsync(650));
      expect(getSearch()).toEqual({ keyword: 'Aspirin' });
      expect(keywords).toHaveValue('Aspirin');
      expect(screen.getAllByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveLength(10);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['en', 'fr'] as const)(
    'refreshes cached no-lot matches for a %s keyword on language changes',
    async (language) => {
      const { user } = setup(true, (client) =>
        client.setQueryData(editorStockOptions().queryKey, [card, { ...other, lot: null }]),
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
      await filter(user, formatDateValue('2099-01-30', language));
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
    await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), '27');
    await filter(user, '27');
    const quantity = screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ });
    await user.clear(quantity);
    await user.type(quantity, '28');
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('28');
    await filter(user, '28');
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('28');
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
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it.each(['products', 'reasons'] as const)(
    'retries a failed %s request in the content',
    async (source) => {
      const fetch = source === 'products' ? fetchEventStockCards : fetchValidReasons;
      const failure = httpError(500);
      const onCaughtError = vi.fn();
      vi.mocked(fetch).mockRejectedValueOnce(failure);
      if (source === 'products')
        vi.mocked(fetchEventStockCards).mockResolvedValueOnce([card, other]);
      else
        vi.mocked(fetchValidReasons).mockResolvedValueOnce([
          { id: 'assignment', reason, hidden: false },
        ]);
      const { user } = setup(
        true,
        (client) =>
          client.removeQueries({
            queryKey:
              source === 'products'
                ? editorStockOptions().queryKey
                : editorReasonsOptions().queryKey,
          }),
        { onCaughtError },
      );
      const retry = await screen.findByRole('button', { name: 'Try Again' });
      expect(retry.closest('.flex-wrap')).toBeNull();
      await user.click(retry);
      await screen.findByRole('combobox', { name: 'Product' });
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument(),
      );
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(onCaughtError.mock.calls.map(([error]) => error)).toEqual([failure]);
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
      const { user, onSubmitted, queryClient } = setup(true, undefined, { kind: 'issue' });
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      await validIssueLine(user);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await user.click(await screen.findByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(submitStockEvent).toHaveBeenCalledOnce());
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
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('17');
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
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('17');
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
        screen.getByRole('textbox', { name: /^Reason Comments, Aspirin LOT/ }),
        'Broken',
      );
      await user.click(screen.getByRole('button', { name: /^Date, Aspirin/ }));
      await user.click(await screen.findByRole('button', { name: /October 1st, 2026/ }));
      const date = screen.getByRole('button', { name: /^Date, Aspirin/ }).textContent;
      await user.click(screen.getByRole('button', { name: /^Remove, Aspirin/ }));
      if (method === 'manual') await user.click(screen.getByRole('button', { name: 'Add' }));
      else
        await act(async () => {
          await scan(
            { ok: true, gtin: '00012345678905', lotCode: 'LOT', warnings: [], unparsed: {} },
            new AbortController().signal,
          );
        });
      expect(
        await screen.findByRole('textbox', { name: /^Reason Comments, Aspirin LOT/ }),
      ).toHaveValue('Broken');
      expect(screen.getByRole('combobox', { name: /^Reason, Aspirin/ })).toHaveTextContent('Lost');
      expect(screen.getByRole('button', { name: /^Date, Aspirin/ })).toHaveTextContent(date ?? '');
    },
  );
  it('drops a scan lookup that finishes while signing', async () => {
    const { user } = setup();
    await validLine(user);
    const quantity = screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ });
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
  it('revalidates current lines at Confirm and shows the validation dialog without posting', async () => {
    const { user } = setup();
    await validLine(user);
    const quantity = screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ });
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('dialog');
    act(() => fireEvent.change(quantity, { target: { value: '65' } }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(submitStockEvent).not.toHaveBeenCalled();
    expect(quantity).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      en['stock-adjustment.invalid-title'],
    );
    expect(quantity).toHaveAccessibleDescription(
      en['stock-events.quantity-greater-than-stock-on-hand'],
    );
  });

  it('copies reason, comments and date into another line, then removes it with focus on the remaining action', async () => {
    const { user } = setup();
    await add(user);
    await pickReason(user);
    await user.type(
      screen.getByRole('textbox', { name: /^Reason Comments, Aspirin LOT/ }),
      'Broken',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getAllByRole('combobox', { name: /^Reason, Aspirin/ })).toHaveLength(2);
    expect(
      screen.getAllByRole('textbox', { name: /^Reason Comments, Aspirin LOT/ })[0],
    ).toHaveValue('Broken');
    const dates = screen.getAllByRole('button', { name: /^Date, Aspirin/ });
    expect(dates[0]).toHaveTextContent(dates[1].textContent ?? '');
    await user.click(screen.getAllByRole('button', { name: /^Remove, Aspirin/ })[0]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Remove, Aspirin/ })).toHaveFocus(),
    );
  });
  it('keeps the quantity through Packs and Doses switches', async () => {
    const { user } = setup();
    await validLine(user);
    await user.click(screen.getByRole('radio', { name: 'Packs' }));
    expect(
      screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT, Line \d+ Packs$/ }),
    ).toHaveValue('1');
    expect(
      screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT, Line \d+ Doses$/ }),
    ).toHaveValue('1');
    await user.click(screen.getByRole('radio', { name: 'Doses' }));
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('17');
  });
  it('shows Arabic digit quantities correctly in the packs total', async () => {
    localStorage.setItem('adjustment-columns', JSON.stringify({ total: true }));
    const { user } = setup();
    await add(user);
    await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), '١٧');
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
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /^Quantity, Aspirin OTHER/ }),
    ).not.toBeInTheDocument();
  });
  it('uses stored details and Toggle Details on phones and keeps Remove working', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(400);
    localStorage.setItem('adjustment-columns', JSON.stringify({ expiry: false }));
    const { user } = setup();
    await add(user);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const card = screen.getByText('Aspirin (C1)').closest('li') as HTMLLIElement;
    expect(within(card).getByText('Pack Size')).toBeInTheDocument();
    expect(within(card).queryByText('Expiry Date')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View' }));
    expect(screen.getByText('Toggle Details')).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemcheckbox', { name: 'Product Code' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Pack Size' }));
    await user.keyboard('{Escape}');
    expect(within(card).queryByText('Pack Size')).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: /^Remove,/ }));
    expect(screen.queryByText('Aspirin (C1)')).not.toBeInTheDocument();
  });
  async function validateHiddenRows() {
    const { user } = setup();
    await add(user);
    act(() => {
      const addButton = screen.getByRole('button', { name: 'Add' });
      for (let index = 0; index < 10; index++) fireEvent.click(addButton);
    });
    await filter(user, 'missing');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      en['stock-adjustment.invalid-title'],
    );
    await user.click(screen.getByRole('button', { name: /^Close$/ }));
    await waitFor(() =>
      expect(screen.getAllByRole('combobox', { name: /^Reason, Aspirin/ })[0]).toHaveFocus(),
    );
    expect(screen.getAllByText('This field is required').length).toBeGreaterThan(0);
    expect(submitStockEvent).not.toHaveBeenCalled();
  }
  it('validates hidden table rows and returns to the first invalid field', async () => {
    await validateHiddenRows();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
  it('scrolls the invalid card into view before focusing its first invalid field', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(400);
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      await validateHiddenRows();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(scroll).toHaveBeenCalledWith({ block: 'start' });
      expect(scroll.mock.calls.at(-1)).toEqual([{ block: 'nearest', inline: 'nearest' }]);
      expect(scroll.mock.contexts.some((element) => element instanceof HTMLLIElement)).toBe(true);
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScroll;
    }
  });
  it('duplicate confirmation queues exactly one dose-based Adjustment without a POST', async () => {
    const { user, onSubmitted } = setup();
    await validLine(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.type(await screen.findByRole('textbox', { name: 'Signature' }), 'Ada');
    await user.dblClick(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
    const rows = await getLocalDb().table('stockEventQueue').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual({
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
    expect(submitStockEvent).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenLastCalledWith(en['stock-events.queued-title'], {
      description: en['stock-events.queued-description'],
    });
  });
  it('accepted device delivery shows Synced and uses the online landing', async () => {
    vi.mocked(waitForStockEventReceipt).mockImplementationOnce(async (event) => ({
      kind: 'accepted',
      receipt: {
        draftId: event.draftId,
        revision: event.revision,
        localEventId: event.localEventId,
        acceptedAt: Date.now(),
        source: 'server',
        serverEventId: 'accepted-event',
        event,
      },
    }));
    const { user, onSubmitted } = setup();
    await validLine(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('accepted-event', true));
    expect(toast.success).toHaveBeenLastCalledWith(en['device-events.synced'], {
      description: en['stock-adjustment.submitted-description'],
    });
    expect(toast.warning).not.toHaveBeenCalled();
  });
  it.each([
    {
      kind: 'uncertain',
      title: 'device-events.needs-review',
      description: 'device-events.needs-review-description',
    },
    {
      kind: 'blocked',
      title: 'device-events.blocked-title',
      description: 'device-events.blocked-description',
    },
    {
      kind: 'held',
      reason: 'access-changed',
      title: 'device-events.access-changed',
      description: 'device-events.access-changed-held-description',
    },
    {
      kind: 'held',
      reason: 'draft-changed',
      title: 'device-events.draft-changed',
      description: 'device-events.draft-changed-held-description',
    },
  ] as const)(
    '$kind $reason delivery warns with its cause and uses the program-list landing',
    async (outcome) => {
      vi.mocked(waitForStockEventReceipt).mockResolvedValueOnce(outcome);
      const { user, onSubmitted } = setup();
      await validLine(user);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await user.click(await screen.findByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(expect.any(String), false));
      expect(toast.warning).toHaveBeenCalledWith(en[outcome.title], {
        description: en[outcome.description],
        action: { label: en['device-events.review'], onClick: expect.any(Function) },
      });
      expect(toast.success).not.toHaveBeenCalled();
    },
  );
  it('online refusal stays in the editor with the server message and safely reopens a corrected copy', async () => {
    vi.mocked(waitForStockEventReceipt).mockImplementationOnce(async (event) => {
      await syncStockEvents(getLocalDb(), event.userId, {
        check: () => {},
        canSend: () => true,
        permitted: () => true,
        send: async () => ({
          status: 400,
          data: { messageKey: 'stock-changed', message: 'Backdated stock would be negative' },
        }),
        retryReceipt: async () => {},
        accepted: () => {},
      });
      return {
        kind: 'refused',
        error: await getLocalDb().table('stockEventSyncErrors').get(event.localEventId),
      };
    });
    const { user, onSubmitted } = setup();
    await validLine(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    const failure = await screen.findByRole('alertdialog');
    expect(failure).toHaveTextContent('Backdated stock would be negative');
    expect(within(failure).getByRole('button', { name: 'Review Device Events' })).toBeEnabled();
    expect(
      screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/, hidden: true }),
    ).toHaveValue('17');
    expect(screen.getByRole('button', { name: 'Submit', hidden: true })).toBeDisabled();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    await user.click(within(failure).getByRole('button', { name: 'Copy For Correction' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled());
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('17');
    const drafts = await getLocalDb().table('stockEventDrafts').toArray();
    expect(drafts.map((row) => row.state).sort()).toEqual(['editing', 'refused']);
    expect(await getLocalDb().table('stockEventQueue').count()).toBe(0);
    expect(onSubmitted).not.toHaveBeenCalled();
  });
  it('formats refusal detail times in the deployment zone while keeping transport fields out', async () => {
    vi.mocked(waitForStockEventReceipt).mockImplementationOnce(async (event) => {
      await syncStockEvents(getLocalDb(), event.userId, {
        check: () => {},
        canSend: () => true,
        permitted: () => true,
        send: async () => ({
          status: 400,
          data: {
            messageKey: 'stock-changed',
            message: 'Backdated stock would be negative',
            internal: 'secret-debug-value',
          },
        }),
        retryReceipt: async () => {},
        accepted: () => {},
      });
      return {
        kind: 'refused',
        error: await getLocalDb().table('stockEventSyncErrors').get(event.localEventId),
      };
    });
    const { user } = setup(true, (client) =>
      client.setQueryData(deploymentTimeZoneOptions().queryKey, {
        zone: 'Pacific/Auckland',
        read: true,
      }),
    );
    await validLine(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    const failure = await screen.findByRole('alertdialog');
    await user.click(within(failure).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Copy For Correction' }));
    const details = await screen.findByRole('dialog');
    const error = await getLocalDb().table('stockEventSyncErrors').toCollection().first();
    expect(details).toHaveTextContent(
      formatTimestamp(new Date(error.event.queuedAt).toISOString(), 'en', {
        time: true,
        timeZone: 'Pacific/Auckland',
      }),
    );
    expect(details).not.toHaveTextContent('secret-debug-value');
    expect(details).not.toHaveTextContent('Saved Revision');
  });
  it('failed local enqueue never shows success or freezes the draft', async () => {
    const { user, onSubmitted } = setup();
    await validLine(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    vi.spyOn(getLocalDb().table('stockEventQueue'), 'add').mockRejectedValueOnce(
      new Error('quota'),
    );
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      en['stock-events.draft-failed'],
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(submitStockEvent).not.toHaveBeenCalled();
    expect(await getLocalDb().table('stockEventQueue').count()).toBe(0);
    const drafts = await getLocalDb().table('stockEventDrafts').toArray();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].state).toBe('editing');
  });
  it.each([httpError(400, { message: 'Stock changed' }), networkError()])(
    'keeps lines after submit failure without retrying',
    async (error) => {
      vi.mocked(submitStockEvent).mockRejectedValueOnce(error);
      const { user, onSubmitted } = setup(true, undefined, { kind: 'issue' });
      await validIssueLine(user);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await user.click(await screen.findByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(await screen.findByRole('alertdialog')).toHaveTextContent(
        error.response
          ? 'Stock changed'
          : 'Check the stock card before submitting again. The server may already have recorded this stock event.',
      );
      await user.click(screen.getByRole('button', { name: /^Close$/ }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus());
      expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('17');
      if (error.response) expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      else
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Check the stock card before submitting again. The server may already have recorded this stock event.',
        );
      expect(submitStockEvent).toHaveBeenCalledOnce();
      expect(onSubmitted).not.toHaveBeenCalled();
      if (!error.response) {
        let finish!: (id: string) => void;
        vi.mocked(submitStockEvent).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        );
        await user.click(screen.getByRole('button', { name: 'Submit' }));
        await user.click(await screen.findByRole('button', { name: 'Confirm' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        await waitFor(() => expect(finish).toBeTypeOf('function'));
        await act(async () => finish('event'));
        await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
      }
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
    expect(await screen.findByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue(
      '16',
    );
    await act(async () => {
      await scan(parsed, signal);
    });
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('32');
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
      for (const input of screen.getAllByRole('textbox', { name: /^Quantity, Aspirin LOT/ }))
        fireEvent.change(input, { target: { value: '1' } });
    });
    await filter(user, 'missing');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: /^Close$/ }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveFocus(),
    );
    expect(screen.getAllByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveLength(1);
  });
  it('confirms an expiry mismatch once per batch across expiry values and editor openings and ignores aborted scans', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Product' })).toBeEnabled());
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
      screen.queryByRole('textbox', { name: /^Quantity, Aspirin LOT/ }),
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
    expect(await screen.findByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue(
      '16',
    );
    await act(async () => {
      operation = scan({ ...parsed, expiry: '2028-01-01', lotCode: 'lot' }, signal);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await act(async () => {
      await operation;
    });
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('32');
    await screen.findByText('Saved on this device');
    cleanup();
    setup();
    expect(await screen.findByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue(
      '32',
    );
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Product' })).toBeEnabled());
    await act(async () => {
      await scan({ ...parsed, expiry: '2029-01-01' }, signal);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('48');
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
        queryKey: editorReasonsOptions().queryKey,
      }),
    { defaultReasonId: 'lost' },
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
      client.setQueryData(editorStockOptions().queryKey, [
        { ...card, lot: null },
        {
          ...other,
          lot: enabled ? other.lot : null,
          orderable: { ...other.orderable, extraData: { useVVM: enabled ? 'true' : 'false' } },
        },
      ]),
    );
    await add(user, enabled ? 'No Lot Defined' : 'Product Has No Lots');
    for (const name of ['Lot Code', 'Expiry Date', 'VVM Status']) {
      expect(!!screen.queryByRole('columnheader', { name })).toBe(enabled);
    }
  },
);
it('allows leaving a queued Adjustment without retiring its frozen draft', async () => {
  const { user, onSubmitted, router } = setup(true, undefined, { browserHistory: true });
  await validLine(user);
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  await user.click(await screen.findByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
  const unload = new Event('beforeunload', { cancelable: true });
  fireEvent(window, unload);
  expect(unload.defaultPrevented).toBe(false);
  const [draft] = await getLocalDb().table('stockEventDrafts').toArray();
  expect(draft.state).toBe('queued');
  expect(refreshOfflineProgram).not.toHaveBeenCalled();
  router?.history.destroy();
});

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
      client.setQueryData(editorStockOptions('issue').queryKey, [
        { ...card, lot: { id: 'lot', lotCode: 'LOT', expirationDate: '2019-01-30' } },
        zero,
        other,
      ]);
      client.setQueryData(editorReasonsOptions('issue').queryKey, [
        { reason: { ...reason, reasonCategory: 'TRANSFER' }, hidden: false },
      ]);
    },
    { defaultReasonId: 'lost', kind: 'issue' },
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
  const issueSetup = (
    configure?: (client: QueryClient) => void,
    { onCaughtError }: Pick<RenderOptions, 'onCaughtError'> = {},
  ) =>
    setup(
      true,
      (client) => {
        client.setQueryData(editorStockOptions('issue').queryKey, [other]);
        client.setQueryData(editorReasonsOptions('issue').queryKey, [
          {
            id: 'transfer',
            reason: { ...reason, name: 'Transfer Out', reasonCategory: 'TRANSFER' },
            hidden: false,
          },
        ]);
        configure?.(client);
      },
      { kind: 'issue', onCaughtError },
    );

  it('marks Issue To on lines added after a failed Submit', async () => {
    const { user } = issueSetup();
    await add(user, 'OTHER');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: /^Close$/ }));
    await add(user, 'OTHER');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: /^Close$/ }));
    for (const destination of screen.getAllByRole('combobox', { name: /^Issue To,/ }))
      expect(destination).toHaveAttribute('aria-invalid', 'true');
    for (const quantity of screen.getAllByRole('textbox', { name: /^Quantity,/ }))
      expect(quantity).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks Issue To and the pager on later pages after a failed Submit', async () => {
    const { user } = issueSetup();
    await add(user, 'OTHER');
    act(() => {
      for (let index = 0; index < 10; index++)
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: /^Close$/ }));
    const page2 = screen.getByRole('button', { name: 'Page 2: Contains Invalid Rows' });
    await user.click(page2);
    const destination = await screen.findByRole('combobox', { name: /^Issue To,/ });
    await waitFor(() => expect(destination).toHaveAttribute('aria-invalid', 'true'));
    await user.click(screen.getByRole('button', { name: /^Page 1/ }));
    for (const field of await screen.findAllByRole('combobox', { name: /^Issue To,/ }))
      await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
  });

  it('leaves Issue To blank, focuses its error, clears comments on change and clears an optional reason', async () => {
    const { user } = issueSetup();
    await add(user, 'OTHER');
    const destination = screen.getByRole('combobox', { name: /^Issue To, Aspirin OTHER/ });
    expect(destination).toHaveTextContent('Select An Option');
    expect(
      screen.queryByRole('textbox', { name: /^Destination Comments, Aspirin OTHER/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(en['stock-issue.invalid-title']);
    expect(dialog).toHaveTextContent(en['stock-issue.invalid-description']);
    expect(destination).toHaveAttribute('aria-invalid', 'true');
    expect(destination).toHaveAccessibleDescription('This field is required');
    expect(
      document.getElementById('lines[0].counterparty-error')?.closest('.sr-only'),
    ).not.toBeNull();
    await user.click(screen.getByRole('button', { name: /^Close$/ }));
    await waitFor(() => expect(destination).toHaveFocus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent('This field is required');
    await user.click(destination);
    await user.click(await screen.findByRole('option', { name: 'CHW' }));
    const comments = screen.getByRole('textbox', { name: /^Destination Comments, Aspirin OTHER/ });
    expect(comments).toHaveAttribute('maxlength', '255');
    await user.type(comments, 'Courier');
    await user.click(destination);
    await user.click(await screen.findByRole('option', { name: 'Hospital' }));
    expect(comments).not.toBeInTheDocument();
    await user.click(destination);
    await user.click(await screen.findByRole('option', { name: 'CHW' }));
    expect(
      screen.getByRole('textbox', { name: /^Destination Comments, Aspirin OTHER/ }),
    ).toHaveValue('');
    const select = screen.getByRole('combobox', { name: /^Reason, Aspirin OTHER/ });
    expect(select).not.toHaveAttribute('aria-required', 'true');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Transfer Out' }));
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Select An Option' }));
    expect(
      screen.queryByRole('textbox', { name: /^Reason Comments, Aspirin OTHER/ }),
    ).not.toBeInTheDocument();
    expect(destination).toHaveTextContent('CHW');
  });

  it('clears a chosen Issue To with its comments and requires it again on Submit', async () => {
    const { user } = issueSetup();
    await add(user, 'OTHER');
    const destination = screen.getByRole('combobox', { name: /^Issue To, Aspirin OTHER/ });
    await user.click(destination);
    await user.click(await screen.findByRole('option', { name: 'CHW' }));
    await user.type(
      screen.getByRole('textbox', { name: /^Destination Comments, Aspirin OTHER/ }),
      'Courier',
    );
    await user.click(destination);
    await user.click(await screen.findByRole('option', { name: 'Select An Option' }));
    expect(destination).toHaveTextContent('Select An Option');
    expect(
      screen.queryByRole('textbox', { name: /^Destination Comments, Aspirin OTHER/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(destination).toHaveAttribute('aria-invalid', 'true');
  });

  it('copies the destination comments, filters the destination name and submits its node id', async () => {
    vi.mocked(submitStockEvent).mockResolvedValue('issue-event');
    const { user, onSubmitted, queryClient } = issueSetup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await add(user, 'OTHER');
    await user.click(screen.getByRole('combobox', { name: /^Issue To, Aspirin OTHER/ }));
    await user.click(await screen.findByRole('option', { name: 'CHW' }));
    await user.type(
      screen.getByRole('textbox', { name: /^Destination Comments, Aspirin OTHER/ }),
      'Courier',
    );
    await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin OTHER/ }), '2');
    await add(user, 'OTHER');
    expect(
      screen.getAllByRole('textbox', { name: /^Destination Comments, Aspirin OTHER/ })[0],
    ).toHaveValue('Courier');
    await user.type(screen.getAllByRole('textbox', { name: /^Quantity, Aspirin OTHER/ })[0], '3');
    await filter(user, 'CHW');
    expect(screen.getAllByRole('textbox', { name: /^Quantity, Aspirin OTHER/ })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('issue-event'));
    for (const queryKey of [
      queryKeys.stockEvents.all,
      queryKeys.stockCards.all,
      queryKeys.stockCardSummaries.all,
    ])
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
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
    const failure = new Error('Unavailable');
    const onCaughtError = vi.fn();
    vi.mocked(fetchValidAssignments).mockRejectedValueOnce(failure).mockResolvedValue(destinations);
    const { user } = issueSetup(
      (client) =>
        client.removeQueries({
          queryKey: validDestinationsOptions({ facilityId: 'facility', programId: 'program' })
            .queryKey,
        }),
      { onCaughtError },
    );
    expect(await screen.findByText('Could Not Load Destinations')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled());
    expect(onCaughtError.mock.calls.map(([error]) => error)).toEqual([failure]);
  });
  it('keeps a refused destination lookup short and disables submission', async () => {
    const failure = httpError(403);
    const onCaughtError = vi.fn();
    vi.mocked(fetchValidAssignments).mockRejectedValueOnce(failure);
    issueSetup(
      (client) =>
        client.removeQueries({
          queryKey: validDestinationsOptions({ facilityId: 'facility', programId: 'program' })
            .queryKey,
        }),
      { onCaughtError },
    );
    expect(await screen.findByText(en['no-access.description'])).toBeInTheDocument();
    expect(screen.queryByText('Could Not Load Destinations')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    expect(scanningEnabled).toBe(false);
    expect(onCaughtError.mock.calls.map(([error]) => error)).toEqual([failure]);
  });
});

describe('readiness after a failed background refetch', () => {
  it.each(['reasons', 'destinations'] as const)(
    'keeps Add, scan and Submit usable after a failed %s refetch',
    async (lookup) => {
      const { user, queryClient } = setup(
        true,
        (client) =>
          client.setQueryData(
            editorStockOptions(lookup === 'destinations' ? 'issue' : 'adjustment').queryKey,
            [other],
          ),
        { kind: lookup === 'destinations' ? 'issue' : 'adjustment' },
      );
      await add(user, 'OTHER');
      await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin OTHER/ }), '17');
      expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
      const queryKey =
        lookup === 'reasons'
          ? editorReasonsOptions().queryKey
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

it('retains draft lot and VVM columns when refreshed stock no longer offers them', async () => {
  localStorage.setItem('adjustment-columns', JSON.stringify({ expiry: true }));
  const { user, queryClient } = setup(true, (client) =>
    client.setQueryData(editorStockOptions().queryKey, [
      { ...other, orderable: { ...other.orderable, extraData: { useVVM: 'true' } } },
    ]),
  );
  await add(user, 'OTHER');
  for (const name of ['Lot Code', 'Expiry Date', 'VVM Status']) {
    expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
  }
  act(() => {
    queryClient.setQueryData(editorStockOptions().queryKey, [{ ...card, lot: null }]);
  });
  await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Lot Code' })).toBeNull());
  for (const name of ['Lot Code', 'Expiry Date', 'VVM Status']) {
    expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
  }
  expect(screen.getByText('OTHER')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /^VVM Status, Aspirin OTHER/ })).toBeInTheDocument();
});

it('keeps the empty table busy until stock cards determine its lot and VVM columns', async () => {
  let finish!: (cards: EventStockCard[]) => void;
  vi.mocked(fetchEventStockCards).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  setup(true, (client) =>
    client.removeQueries({
      queryKey: editorStockOptions().queryKey,
    }),
  );
  const header = await screen.findByRole('columnheader', { name: 'Product' });
  expect(header.closest('[aria-busy="true"]')).not.toBeNull();
  await act(async () => finish([other]));
  await waitFor(() =>
    expect(
      screen.getByRole('columnheader', { name: 'Lot Code' }).closest('[aria-busy="true"]'),
    ).toBeNull(),
  );
});

it('stops announcing a busy table after stock cards fail and keeps the retry available', async () => {
  const failure = new Error('Unavailable');
  const onCaughtError = vi.fn();
  vi.mocked(fetchEventStockCards).mockRejectedValue(failure);
  setup(
    true,
    (client) =>
      client.removeQueries({
        queryKey: editorStockOptions().queryKey,
      }),
    { onCaughtError },
  );
  await waitFor(() =>
    expect(screen.getByText(en['stock-events.cards-error-title'])).toBeInTheDocument(),
  );
  expect(
    screen.getByRole('columnheader', { name: 'Product' }).closest('[aria-busy="true"]'),
  ).toBeNull();
  expect(screen.getByRole('button', { name: 'Try Again' })).toBeEnabled();
  expect(onCaughtError.mock.calls.map(([error]) => error)).toEqual([failure]);
});

it('discards frozen row widths after unit or language changes while no rows match', async () => {
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 175,
    height: 28,
    top: 0,
    bottom: 28,
    left: 0,
    right: 175,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  try {
    const { user } = setup();
    await add(user);
    await filter(user, 'missing');
    await screen.findByText('No Matching Products');
    const measured = () => document.querySelector('[style*="--table-width"]');
    expect(measured()).not.toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Packs' }));
    expect(measured()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear Filter' }));
    await filter(user, 'missing');
    await screen.findByText('No Matching Products');
    expect(measured()).not.toBeNull();
    await act(async () => i18n.changeLanguage('fr'));
    expect(measured()).toBeNull();
  } finally {
    bounds.mockRestore();
  }
});

it('releases frozen row widths when the editor container resizes without matching rows', async () => {
  let resize!: () => void;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(element: Element) {
        if (element.firstElementChild?.tagName === 'FORM') {
          resize = () =>
            this.callback(
              [{ contentRect: { width: 900 } } as ResizeObserverEntry],
              this as unknown as ResizeObserver,
            );
        }
      }
      disconnect() {}
    },
  );
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 175,
    height: 28,
    top: 0,
    bottom: 28,
    left: 0,
    right: 175,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  try {
    const { user } = setup();
    await add(user);
    await filter(user, 'missing');
    await screen.findByText('No Matching Products');
    expect(document.querySelector('[style*="--table-width"]')).not.toBeNull();
    act(resize);
    expect(document.querySelector('[style*="--table-width"]')).toBeNull();
  } finally {
    bounds.mockRestore();
  }
});

describe('Receive editor', () => {
  const vaccine = {
    id: 'vaccine',
    productCode: 'V1',
    fullProductName: 'Vaccine',
    description: null,
    netContent: 10,
    extraData: { useVVM: 'true' },
  };
  const aspirin = { ...card.orderable, description: null };
  beforeEach(() => {
    vi.mocked(fetchApprovedProducts).mockResolvedValue({
      content: [aspirin, vaccine].map((orderable) => ({
        id: `approved-${orderable.id}`,
        orderable,
      })),
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(fetchFacilityOrderableFulfills).mockResolvedValue({});
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([]);
    vi.mocked(fetchLotsByTradeItems).mockResolvedValue([]);
    vi.mocked(fetchEventStockOnHand).mockResolvedValue({});
  });
  const receiveSetup = () =>
    setup(
      true,
      (client) => {
        client.setQueryData(editorReasonsOptions('receive').queryKey, [
          {
            id: 'transfer',
            reason: {
              ...reason,
              name: 'Transfer In',
              reasonType: 'CREDIT',
              reasonCategory: 'TRANSFER',
            },
            hidden: false,
          },
        ]);
        client.setQueryData(
          validSourcesOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
          destinations,
        );
      },
      { kind: 'receive', canManageLots: true },
    );
  async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Product' })).toBeEnabled());
    await user.click(screen.getByRole('combobox', { name: 'Product' }));
    await user.click(await screen.findByRole('option', { name }));
  }
  function cell(row: number, header: string) {
    const table = screen.getByRole('table');
    const index = within(table)
      .getAllByRole('columnheader')
      .findIndex((item) => item.textContent === header);
    expect(index).toBeGreaterThan(-1);
    return within(within(table).getAllByRole('row')[row]).getAllByRole('cell')[index];
  }

  it('shows blank stock on hand for a stockless product and VVM Status once a line uses VVM', async () => {
    const { user } = receiveSetup();
    await screen.findByRole('columnheader', { name: 'Lot Code' });
    expect(screen.getByRole('columnheader', { name: 'Expiry Date' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'VVM Status' })).not.toBeInTheDocument();
    await pick(user, 'Vaccine');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('columnheader', { name: 'VVM Status' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^VVM Status, Vaccine/ })).toBeInTheDocument();
    expect(cell(1, 'Lot Code')).toHaveTextContent('Product Has No Lots');
    expect(cell(1, 'Stock On Hand')).toHaveTextContent(/^$/);
  });

  it('preserves an open lot edit and its typed value when cards switch to a table', async () => {
    let width = 500;
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => width);
    const observers = new Set<ResizeObserverCallback>();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe() {
          observers.add(this.callback);
        }
        disconnect() {
          observers.delete(this.callback);
        }
      },
    );
    const { user } = receiveSetup();
    await pick(user, 'Aspirin');
    await user.click(await screen.findByRole('combobox', { name: 'Lot Code' }));
    await user.click(await screen.findByRole('option', { name: 'Add New Lot' }));
    await user.type(screen.getByRole('textbox', { name: 'New Lot Code' }), 'NEW-1{Enter}');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole('button', { name: 'Edit Lot, Aspirin NEW-1, Line 1' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit Lot' });
    const code = await within(dialog).findByRole('textbox', { name: 'Lot Code' });
    await user.clear(code);
    await user.type(code, 'TYPED-LOT');
    act(() => {
      width = 900;
      for (const callback of observers) {
        callback([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
      }
    });
    expect(screen.getByRole('table', { hidden: true })).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog', { name: 'Edit Lot' })).getByRole('textbox', {
        name: 'Lot Code',
      }),
    ).toHaveValue('TYPED-LOT');
  });

  it('edits new lot codes and shared expiry, then invalidates lots after submission', async () => {
    vi.mocked(submitStockEvent).mockResolvedValue('receive-event');
    const { user, queryClient, onSubmitted } = receiveSetup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await pick(user, 'Aspirin');
    await user.click(await screen.findByRole('combobox', { name: 'Lot Code' }));
    await user.click(await screen.findByRole('option', { name: 'Add New Lot' }));
    await user.type(screen.getByRole('textbox', { name: 'New Lot Code' }), 'NEW-1{Enter}');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getAllByRole('button', { name: /^Edit Lot, Aspirin NEW-1/ })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Edit Lot, Aspirin NEW-1, Line 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Lot' });
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: 'Lot Code' })).toHaveFocus(),
    );
    await user.click(within(dialog).getByRole('button', { name: /^Expiration Date/ }));
    const calendar = await screen.findByRole('dialog', { name: /Expiration Date/ });
    await user.click(within(calendar).getByRole('button', { name: /next month/i }));
    const next = new Date();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    next.setDate(15);
    await user.click(within(calendar).getByRole('button', { name: /15th/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const editButton = screen.getByRole('button', { name: 'Edit Lot, Aspirin NEW-1, Line 1' });
    await waitFor(() => expect(editButton).toHaveFocus());
    const shown = formatDateValue(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-15`,
      'en',
    );
    expect(cell(1, 'Expiry Date')).toHaveTextContent(shown);
    expect(cell(2, 'Expiry Date')).toHaveTextContent(shown);
    await user.click(screen.getByRole('button', { name: 'Edit Lot, Aspirin NEW-1, Line 2' }));
    const second = await screen.findByRole('dialog', { name: 'Edit Lot' });
    const code = within(second).getByRole('textbox', { name: 'Lot Code' });
    await user.clear(code);
    await user.type(code, 'NEW-2{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      screen.getByRole('button', { name: 'Edit Lot, Aspirin NEW-1, Line 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Lot, Aspirin NEW-2, Line 2' }),
    ).toBeInTheDocument();
    for (const quantity of screen.getAllByRole('textbox', { name: /^Quantity, Aspirin/ }))
      await user.type(quantity, '2');
    for (const source of screen.getAllByRole('combobox', { name: /^Received From,/ })) {
      await user.click(source);
      await user.click(await screen.findByRole('option', { name: 'Hospital' }));
    }
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('receive-event'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.lots.all });
  });

  describe('scanning', () => {
    const fulfiller = {
      ...aspirin,
      id: 'fulfiller',
      fullProductName: 'Aspirin Box',
      identifiers: { tradeItem: 'box' },
    };
    const parsed = {
      ok: true as const,
      gtin: '00012345678905',
      lotCode: 'lot-1',
      warnings: [],
      unparsed: {},
    };
    beforeEach(() => {
      vi.mocked(fetchTradeItemByGtin).mockResolvedValue({ id: 'box' } as never);
      vi.mocked(fetchOrderablesByTradeItems).mockResolvedValue([fulfiller]);
      vi.mocked(fetchApprovedProducts).mockImplementation(async ({ orderableIds }) => ({
        content: (orderableIds ?? ['product']).includes('product')
          ? [{ id: 'approved-product', orderable: aspirin }]
          : [],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 50,
      }));
      vi.mocked(fetchOrderableFulfills).mockResolvedValue({
        fulfiller: { canBeFulfilledByMe: ['product'] },
      });
      vi.mocked(fetchLotsByTradeItems).mockResolvedValue([
        { id: 'lot-1', lotCode: 'LOT-1', expirationDate: '2099-01-31', tradeItemId: 'box' },
      ] as never);
      vi.mocked(fetchEventStockOnHand).mockResolvedValue({});
    });
    async function scanned() {
      await waitFor(() => expect(scanningEnabled).toBe(true));
      let message: Awaited<ReturnType<typeof scan>>;
      await act(async () => {
        message = await scan(parsed, new AbortController().signal);
      });
      return message;
    }

    it('adds a product fulfilling an approved one with its lot and the approved stock lookup', async () => {
      receiveSetup();
      expect(await scanned()).toBeUndefined();
      expect(
        await screen.findByRole('textbox', { name: /^Quantity, Aspirin Box LOT-1/ }),
      ).toHaveValue('16');
      expect(fetchOrderableFulfills).toHaveBeenCalledWith(['fulfiller']);
      expect(fetchEventStockOnHand).toHaveBeenCalledWith(
        expect.objectContaining({ orderableIds: ['product'] }),
      );
    });

    it('refuses a product neither approved nor fulfilling an approved one', async () => {
      vi.mocked(fetchOrderableFulfills).mockResolvedValue({});
      receiveSetup();
      const message = await scanned();
      expect(message).toEqual({
        key: 'scan.product-not-in-program',
        params: { gtin: parsed.gtin },
      });
    });

    it.each([
      {
        stage: 'products',
        hold: (gate: Promise<void>) =>
          vi.mocked(fetchOrderablesByTradeItems).mockImplementationOnce(async () => {
            await gate;
            return [fulfiller];
          }),
        later: () => expect(fetchOrderableFulfills).not.toHaveBeenCalledWith(['fulfiller']),
      },
      {
        stage: 'fulfils',
        hold: (gate: Promise<void>) =>
          vi.mocked(fetchOrderableFulfills).mockImplementationOnce(async () => {
            await gate;
            return { fulfiller: { canBeFulfilledByMe: ['product'] } };
          }),
        later: () =>
          expect(fetchApprovedProducts).not.toHaveBeenCalledWith(
            expect.objectContaining({ orderableIds: ['product'] }),
          ),
      },
      {
        stage: 'lots',
        hold: (gate: Promise<void>) =>
          vi.mocked(fetchLotsByTradeItems).mockImplementationOnce(async () => {
            await gate;
            return [];
          }),
        later: () => {},
      },
    ])('applies nothing when the session changes while $stage load', async ({ hold, later }) => {
      receiveSetup();
      await waitFor(() => expect(scanningEnabled).toBe(true));
      let open!: () => void;
      hold(
        new Promise<void>((resolve) => {
          open = resolve;
        }),
      );
      let operation!: ReturnType<typeof scan>;
      await act(async () => {
        operation = scan(parsed, new AbortController().signal);
      });
      act(() => {
        useLoginData.setState({ referenceDataUserId: 'other-user' });
        useLoginData.setState({ referenceDataUserId: 'ada-id' });
      });
      let message: Awaited<ReturnType<typeof scan>>;
      await act(async () => {
        open();
        message = await operation;
      });
      expect(message).toBeUndefined();
      later();
      expect(screen.queryByRole('textbox', { name: /^Quantity/ })).not.toBeInTheDocument();
    });
  });
});

describe('Unpack editor', () => {
  const kit: Orderable = {
    ...card.orderable,
    description: null,
    id: 'kit',
    fullProductName: 'Delivery Kit',
    children: [
      { orderable: { id: 'gloves' }, quantity: 2 },
      { orderable: { id: 'clamps' }, quantity: 5 },
    ],
  };
  const kitReasons = [
    { ...reason, id: 'unpack', reasonCategory: 'AGGREGATION' },
    { ...reason, id: 'contents', reasonType: 'CREDIT', reasonCategory: 'AGGREGATION' },
  ];
  const ids = { kitUnpackReasonId: 'unpack', unpackedFromKitReasonId: 'contents' };
  function unpackSetup({
    configured = true,
    orderable = kit,
    configure,
    onCaughtError,
  }: {
    configured?: boolean;
    orderable?: Orderable;
    configure?: (client: QueryClient) => void;
    onCaughtError?: RenderOptions['onCaughtError'];
  } = {}) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(editorStockOptions('unpack').queryKey, [{ ...card, orderable }]);
    queryClient.setQueryData(reasonsOptions().queryKey, kitReasons);
    queryClient.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
    configure?.(queryClient);
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([kit]);
    vi.mocked(submitStockEvent).mockResolvedValue('unpack-event');
    const onSubmitted = vi.fn();
    function Page() {
      const [search, setSearch] = useState<EventSearch>({});
      return (
        <I18nextProvider i18n={i18n}>
          <FormMessagesProvider formatError={(key) => i18n.t(key, { defaultValue: key })}>
            <EventEditor
              kind="unpack"
              kitUnpackReasonIds={configured ? ids : undefined}
              canViewStock
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
              <h1>Unpack</h1>
            </EventEditor>
          </FormMessagesProvider>
        </I18nextProvider>
      );
    }
    renderPage(<Page />, { queryClient, onCaughtError });
    return { user: userEvent.setup(), queryClient, onSubmitted };
  }
  async function addKit(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    const quantity = await screen.findByRole('textbox', { name: /^Quantity, Delivery Kit LOT/ });
    await user.type(quantity, '3');
    return quantity;
  }
  const submit = () => screen.getByRole('button', { name: 'Submit' });

  it('labels the picker and product column Kit and omits reasons and destinations with scanning off', async () => {
    const { user } = unpackSetup();
    await addKit(user);
    expect(screen.getByRole('combobox', { name: 'Kit' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Kit' })).toBeInTheDocument();
    for (const name of ['Reason', 'Reason Comments', 'Issue To'])
      expect(screen.queryByRole('columnheader', { name })).not.toBeInTheDocument();
    expect(scanningEnabled).toBe(false);
    expect(screen.queryByText('Ready To Scan')).not.toBeInTheDocument();
    expect(fetchValidReasons).not.toHaveBeenCalled();
    expect(fetchValidAssignments).not.toHaveBeenCalled();
  });

  it('names the user, counts kit lines and confirms the expanded payload without another read', async () => {
    const { user, onSubmitted } = unpackSetup();
    await addKit(user);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(
      screen.getAllByRole('textbox', { name: /^Quantity, Delivery Kit LOT/ })[0],
      '2',
    );
    await user.click(submit());
    const dialog = await screen.findByRole('alertdialog', { name: 'Confirm Kit Unpack' });
    expect(dialog).toHaveTextContent('Do you, ada, wish to confirm the 2 stock unpacking events?');
    expect(screen.queryByRole('textbox', { name: 'Signature' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('unpack-event'));
    expect(fetchOrderablesByIds).toHaveBeenCalledExactlyOnceWith(['kit']);
    expect(submitStockEvent).toHaveBeenCalledOnce();
    expect(vi.mocked(submitStockEvent).mock.calls[0][0].lineItems).toHaveLength(6);
  });

  it('keeps the draft when confirmation is cancelled', async () => {
    const { user } = unpackSetup();
    const quantity = await addKit(user);
    await user.click(submit());
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(quantity).toHaveValue('3');
    await waitFor(() => expect(submit()).toHaveFocus());
    expect(submitStockEvent).not.toHaveBeenCalled();
  });

  it('disables Add and Submit when the reason settings are missing', async () => {
    unpackSetup({ configured: false });
    expect(await screen.findByRole('alert')).toHaveTextContent('Kit Unpack Is Not Set Up');
    expect(screen.getByRole('alert')).toHaveTextContent('KIT_UNPACK_REASON_ID');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(submit()).toBeDisabled();
  });

  it('waits for the reasons list and retries a failed load', async () => {
    const failure = httpError(500);
    const onCaughtError = vi.fn();
    vi.mocked(fetchReasons).mockRejectedValueOnce(failure).mockResolvedValue(kitReasons);
    const { user } = unpackSetup({
      configure: (client) => client.removeQueries({ queryKey: reasonsOptions().queryKey }),
      onCaughtError,
    });
    expect(await screen.findByText(en['stock-events.reasons-error-title'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(submit()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled());
    expect(fetchReasons).toHaveBeenCalledTimes(2);
    expect(onCaughtError.mock.calls.map(([error]) => error)).toEqual([failure]);
  });

  it('stops for changed contents, retains the draft and submits the updated contents next time', async () => {
    const { user } = unpackSetup();
    const quantity = await addKit(user);
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([
      { ...kit, children: [{ orderable: { id: 'gloves' }, quantity: 7 }] },
    ]);
    await user.click(submit());
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      en['stock-unpack.contents-changed-title'],
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'The contents of \u2068Delivery Kit\u2069 changed since you added them. The lines now use the new contents. Submit again to unpack them.',
    );
    expect(submitStockEvent).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(submit()).toHaveFocus());
    expect(quantity).toHaveValue('3');
    await user.click(submit());
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(submitStockEvent).toHaveBeenCalledOnce());
    expect(vi.mocked(submitStockEvent).mock.calls[0][0].lineItems).toEqual([
      expect.objectContaining({ orderableId: 'kit', quantity: 3, lotId: 'lot' }),
      expect.objectContaining({ orderableId: 'gloves', quantity: 21, lotId: null }),
    ]);
  });

  it('uses refreshed picker contents for a newly added kit after contents change', async () => {
    const { user } = unpackSetup();
    await addKit(user);
    const freshKit = { ...kit, children: [{ orderable: { id: 'gloves' }, quantity: 7 }] };
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([freshKit]);
    vi.mocked(fetchEventStockCards).mockResolvedValue([{ ...card, orderable: freshKit }]);
    await user.click(submit());
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(fetchEventStockCards).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(
      screen.getAllByRole('textbox', { name: /^Quantity, Delivery Kit LOT/ })[0],
      '2',
    );
    await user.click(submit());
    const confirmation = await screen.findByRole('alertdialog', { name: 'Confirm Kit Unpack' });
    await user.click(within(confirmation).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(submitStockEvent).toHaveBeenCalledOnce());
    expect(vi.mocked(submitStockEvent).mock.calls[0][0].lineItems).toHaveLength(4);
  });

  it('keeps all draft controls pending until a slow kit refresh settles', async () => {
    const { user } = unpackSetup();
    await addKit(user);
    let finish!: (value: (typeof kit)[]) => void;
    vi.mocked(fetchOrderablesByIds).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await user.click(submit());
    await waitFor(() => expect(fetchOrderablesByIds).toHaveBeenCalledOnce());
    const quantity = screen.getByRole('textbox', { name: /^Quantity, Delivery Kit LOT/ });
    expect(quantity).toBeDisabled();
    expect(submit()).toBeDisabled();
    for (const name of ['Add', 'Clear', /^Date, Delivery Kit/, /^Remove, Delivery Kit/])
      expect(screen.getByRole('button', { name })).toBeDisabled();
    await user.type(quantity, '9');
    expect(quantity).toHaveValue('3');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await act(async () => finish([kit]));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Confirm Kit Unpack');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('textbox', { name: /^Quantity, Delivery Kit LOT/ })).toBeEnabled();
    expect(submit()).toBeEnabled();
  });

  it.each(['success', 'failure'] as const)(
    'ignores a refresh %s after switching users',
    async (outcome) => {
      const { user, onSubmitted } = unpackSetup();
      const quantity = await addKit(user);
      let finish!: () => void;
      vi.mocked(fetchOrderablesByIds).mockReturnValueOnce(
        new Promise((resolve, reject) => {
          finish = () =>
            outcome === 'success' ? resolve([{ ...kit, children: [] }]) : reject(httpError(500));
        }),
      );
      await user.click(submit());
      await waitFor(() => expect(fetchOrderablesByIds).toHaveBeenCalledOnce());
      act(() => useLoginData.setState({ referenceDataUserId: 'other-user' }));
      await act(async () => finish());
      await waitFor(() => expect(submit()).toBeEnabled());
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(quantity).toHaveValue('3');
      expect(submitStockEvent).not.toHaveBeenCalled();
      expect(onSubmitted).not.toHaveBeenCalled();
    },
  );

  it('refreshes a broken kit before validation so the draft recovers after its count is fixed', async () => {
    const { user } = unpackSetup({
      orderable: {
        ...kit,
        children: [{ orderable: { id: 'gloves' }, quantity: null }],
      },
    });
    const quantity = await addKit(user);
    await user.click(submit());
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      en['stock-unpack.contents-changed-title'],
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(quantity).toHaveValue('3');
    await user.click(submit());
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(submitStockEvent).toHaveBeenCalledOnce());
  });

  it.each([httpError(500, { message: 'Cannot read kits' }), networkError()])(
    'keeps the draft after a failed refresh',
    async (error) => {
      const { user } = unpackSetup();
      const quantity = await addKit(user);
      vi.mocked(fetchOrderablesByIds).mockRejectedValueOnce(error);
      await user.click(submit());
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent(
        error.response ? 'Cannot read kits' : en['stock-unpack.refresh-offline'],
      );
      expect(dialog).not.toHaveTextContent(en['stock-events.unknown-outcome-description']);
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(quantity).toHaveValue('3');
      expect(submit()).toBeEnabled();
      expect(submitStockEvent).not.toHaveBeenCalled();
    },
  );
});

it.each([
  { tradeItem: null, key: 'scan.gtin-not-registered' },
  { tradeItem: { id: 'not-stocked' }, key: 'scan.product-not-on-screen' },
])(
  'keeps the online Adjustment scan refusal $key without refetching stock',
  async ({ tradeItem, key }) => {
    vi.mocked(fetchTradeItemByGtin).mockResolvedValueOnce(tradeItem);
    setup();
    await waitFor(() => expect(scanningEnabled).toBe(true));
    let message: Awaited<ReturnType<typeof scan>>;
    await act(async () => {
      message = await scan(
        { ok: true, gtin: '00012345678905', warnings: [], unparsed: {} },
        new AbortController().signal,
      );
    });
    expect(message).toMatchObject({ key });
    expect(fetchTradeItemByGtin).toHaveBeenCalledTimes(1);
    expect(fetchEventStockCards).not.toHaveBeenCalled();
  },
);

it('shows failed local commits with Retry and leave protection until a successful retry', async () => {
  const { user, router } = setup(true, undefined, { browserHistory: true });
  await add(user);
  await screen.findByText('Saved on this device');
  vi.spyOn(getLocalDb().table('stockEventDrafts'), 'put').mockRejectedValueOnce(new Error('quota'));
  await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), '0012');
  await screen.findByText('Could not save on this device. Your latest edits are not saved.');
  expect(screen.queryByText('Saved on this device')).not.toBeInTheDocument();
  const unload = new Event('beforeunload', { cancelable: true });
  fireEvent(window, unload);
  expect(unload.defaultPrevented).toBe(true);
  await user.click(screen.getByRole('button', { name: /^Retry$/ }));
  await screen.findByText('Saved on this device');
  const savedUnload = new Event('beforeunload', { cancelable: true });
  fireEvent(window, savedUnload);
  expect(savedUnload.defaultPrevented).toBe(false);
  router?.history.destroy();
});

it('flushes the final edit on unmount and restores exact quantities without a discard prompt', async () => {
  const { user } = setup();
  await add(user);
  await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), '0012');
  await screen.findByText('Saved on this device');
  const leave = vi.fn();
  act(() => whenLeaveAllowed(leave));
  await waitFor(() => expect(leave).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), {
    target: { value: '0019' },
  });
  cleanup();
  await waitFor(async () => {
    const [saved] = await getLocalDb().table('stockEventDrafts').toArray();
    expect(saved.lines[0].quantity.doses).toBe('0019');
  });
  setup();
  expect(await screen.findByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue(
    '0019',
  );
});

it('keeps committed lines when signing out after a failed device save', async () => {
  const { user } = setup();
  await add(user);
  await screen.findByText('Saved on this device');
  const table = getLocalDb().table('stockEventDrafts');
  const before = await table.toArray();
  vi.spyOn(table, 'put').mockRejectedValueOnce(new Error('quota'));
  await user.type(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), '0012');
  await screen.findByText('Could not save on this device. Your latest edits are not saved.');
  const leave = vi.fn();
  act(() => whenLeaveAllowed(leave));
  await user.click(await screen.findByRole('button', { name: 'Sign Out' }));
  await waitFor(() => expect(leave).toHaveBeenCalledOnce());
  expect(await table.toArray()).toEqual(before);
});

it.each(['navigation', 'sign-out'])(
  'flushes an Adjustment edit during the debounce before %s',
  async (destination) => {
    const { user, router } = setup(true, undefined, { browserHistory: true });
    await add(user);
    await screen.findByText('Saved on this device');
    fireEvent.change(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), {
      target: { value: '0018' },
    });
    expect(screen.getByText('Saving on this device')).toBeVisible();
    if (!router) throw new Error('Missing test router');
    const leave = vi.fn();
    if (destination === 'navigation')
      await act(async () => {
        await router.navigate({ to: '/settings' });
      });
    else {
      act(() => whenLeaveAllowed(leave));
      await waitFor(() => expect(leave).toHaveBeenCalledOnce());
    }
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const [stored] = await getLocalDb().table('stockEventDrafts').toArray();
    expect(stored.lines[0].quantity.doses).toBe('0018');
    if (destination === 'navigation') expect(router.state.location.pathname).toBe('/settings');
    router.history.destroy();
  },
);

it('explains a failed device flush when Submit is clicked', async () => {
  const { user } = setup();
  await validLine(user);
  await screen.findByText('Saved on this device');
  vi.spyOn(getLocalDb().table('stockEventDrafts'), 'put').mockRejectedValueOnce(new Error('quota'));
  fireEvent.change(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }), {
    target: { value: '18' },
  });
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Could Not Save Draft');
  expect(submitStockEvent).not.toHaveBeenCalled();
});

it('refreshes resumed stock and product snapshots while keeping typed values and enforcing the new debit cap', async () => {
  const { user } = setup();
  await validLine(user);
  await screen.findByText('Saved on this device');
  const context = createStockEventContext({
    kind: 'adjustment',
    facilityId: 'facility',
    programId: 'program',
  });
  const previous = await readStockEventDraft(context);
  cleanup();
  const fresh = {
    ...card,
    stockOnHand: 5,
    orderable: { ...card.orderable, fullProductName: 'Fresh Aspirin' },
    lot: { id: 'lot', lotCode: 'FRESH', expirationDate: '2099-01-30' },
  };
  const next = setup(true, (client) =>
    client.setQueryData(editorStockOptions().queryKey, [fresh, other]),
  );
  expect(
    await screen.findByRole('textbox', { name: /^Quantity, Fresh Aspirin FRESH/ }),
  ).toHaveValue('17');
  await screen.findByText('Saved on this device');
  const saved = await readStockEventDraft(context);
  expect(saved?.lines[0]).toMatchObject({
    orderable: fresh.orderable,
    lot: fresh.lot,
    stockOnHand: 5,
    quantity: previous?.lines[0].quantity,
    reasonId: previous?.lines[0].reasonId,
    occurredDate: previous?.lines[0].occurredDate,
  });
  await next.user.click(screen.getByRole('button', { name: 'Submit' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    en['stock-adjustment.invalid-title'],
  );
  await next.user.click(screen.getByRole('button', { name: /^Close$/ }));
  expect(screen.getByRole('textbox', { name: /^Quantity, Fresh Aspirin FRESH/ })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(submitStockEvent).not.toHaveBeenCalled();
});

it('keeps a resumed missing stock line highlighted and explains why it cannot submit', async () => {
  const { user } = setup();
  await validLine(user);
  await screen.findByText('Saved on this device');
  cleanup();
  const next = setup(true, (client) => client.setQueryData(editorStockOptions().queryKey, [other]));
  expect(await screen.findByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('17');
  expect(
    screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ }).closest('tr'),
  ).toHaveAttribute('aria-invalid', 'true');
  await next.user.click(screen.getByRole('button', { name: 'Submit' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    en['stock-events.draft-stock-invalid'],
  );
  expect(submitStockEvent).not.toHaveBeenCalled();
});

it('restores an archived copy, retains the replaced draft, and requires confirmation before deleting it', async () => {
  const { user } = setup(true, (client) =>
    client.setQueryData(deploymentTimeZoneOptions().queryKey, {
      zone: 'Pacific/Auckland',
      read: true,
    }),
  );
  await validLine(user);
  await screen.findByText('Saved on this device');
  const context = createStockEventContext({
    kind: 'adjustment',
    facilityId: 'facility',
    programId: 'program',
  });
  const active = await readStockEventDraft(context);
  if (!active) throw new Error('Missing test draft');
  await act(async () => {
    const copy = await archiveStockEventCopy(context, [
      { ...active.lines[0], quantity: { doses: '0030', packs: '01', remainder: '14' } },
    ]);
    await context.db
      .table('stockEventDrafts')
      .put({ ...copy, savedAt: Date.parse('2026-10-14T23:30:00Z') });
  });
  await user.click(await screen.findByRole('button', { name: 'Archived Copies' }));
  let dialog = await screen.findByRole('dialog', { name: 'Archived Copies' });
  expect(dialog).toHaveTextContent(
    formatTimestamp('2026-10-14T23:30:00Z', 'en', { time: true, timeZone: 'Pacific/Auckland' }),
  );
  await user.click(within(dialog).getByRole('button', { name: /^Actions For Copy/ }));
  await user.click(await screen.findByRole('menuitem', { name: 'Restore' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue('0030');
  expect((await readStockEventDraft(context))?.lines[0].quantity.doses).toBe('0030');
  expect((await readStockEventDraft(context))?.revision).toBe(2);
  expect(screen.queryByText('Saving on this device')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Archived Copies' }));
  dialog = await screen.findByRole('dialog', { name: 'Archived Copies' });
  await user.click(within(dialog).getByRole('button', { name: /^Actions For Copy/ }));
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
  const confirmation = await screen.findByRole('alertdialog');
  expect(await getLocalDb().table('stockEventDrafts').count()).toBe(2);
  await user.click(within(confirmation).getByRole('button', { name: 'Delete' }));
  await waitFor(async () => expect(await getLocalDb().table('stockEventDrafts').count()).toBe(1));
  expect((await readStockEventDraft(context))?.lines[0].quantity.doses).toBe('0030');
});

it('keeps resumed lines when cold stock and reason lookups finish after the device read', async () => {
  const context = createStockEventContext({
    kind: 'adjustment',
    facilityId: 'facility',
    programId: 'program',
  });
  const line = newEventLine(card, undefined, '2026-10-14', {
    kind: 'adjustment',
    productHasLots: true,
  });
  line.quantity = { doses: '0012', packs: '00', remainder: '12' };
  await saveStockEventDraft(context, undefined, [line]);
  let finishCards!: (cards: EventStockCard[]) => void;
  let finishReasons!: (reasons: { reason: typeof reason; hidden: boolean }[]) => void;
  vi.mocked(fetchEventStockCards).mockReturnValueOnce(
    new Promise((resolve) => {
      finishCards = resolve;
    }),
  );
  vi.mocked(fetchValidReasons).mockReturnValueOnce(
    new Promise((resolve) => {
      finishReasons = resolve;
    }),
  );
  setup(true, (client) => {
    client.removeQueries({ queryKey: editorStockOptions().queryKey });
    client.removeQueries({ queryKey: editorReasonsOptions().queryKey });
  });
  await screen.findByText('Saved on this device');
  await act(async () => {
    finishReasons([{ reason, hidden: false }]);
    finishCards([{ ...card, stockOnHand: 5 }, other]);
  });
  expect(await screen.findByRole('textbox', { name: /^Quantity, Aspirin LOT/ })).toHaveValue(
    '0012',
  );
  await screen.findByText('Saved on this device');
  expect((await readStockEventDraft(context))?.lines[0].stockOnHand).toBe(5);
});

it.each(['no stock rights', 'failed read'])(
  'leaves Adjustments without a writer after %s',
  async (condition) => {
    if (condition === 'failed read') {
      vi.spyOn(getLocalDb().table('stockEventDrafts'), 'where').mockImplementationOnce(() => {
        throw new Error('Device read failed');
      });
    }
    window.history.replaceState(null, '', '/');
    const { router } = setup(condition !== 'no stock rights', undefined, { browserHistory: true });
    if (!router) throw new Error('Missing test router');
    try {
      if (condition === 'failed read') await screen.findByText(en['stock-events.draft-failed']);
      else await screen.findByText(en['stock-events.no-stock-view-title']);
      await act(async () => router.navigate({ to: '/settings' }));
      expect(router.state.location.pathname).toBe('/settings');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    } finally {
      router.history.destroy();
    }
  },
);

it('allows a resumed expired-lot Adjustment to submit', async () => {
  const { user } = setup();
  await validLine(user);
  await screen.findByText('Saved on this device');
  cleanup();
  const next = setup(true, (client) =>
    client.setQueryData(editorStockOptions().queryKey, [
      { ...card, lot: { id: 'lot', lotCode: 'LOT', expirationDate: '2019-01-30' } },
      other,
    ]),
  );
  const quantity = await screen.findByRole('textbox', { name: /^Quantity, Aspirin LOT/ });
  expect(quantity).toHaveValue('17');
  expect(quantity.closest('tr')).not.toHaveAttribute('aria-invalid', 'true');
  await next.user.click(screen.getByRole('button', { name: 'Submit' }));
  await next.user.click(await screen.findByRole('button', { name: 'Confirm' }));
  await waitFor(async () => expect(await getLocalDb().table('stockEventQueue').count()).toBe(1));
  expect(submitStockEvent).not.toHaveBeenCalled();
});

it('keeps delete failures out of Archived Copies and restore failures out of Delete', async () => {
  const { user } = setup();
  await validLine(user);
  await screen.findByText('Saved on this device');
  const context = createStockEventContext({
    kind: 'adjustment',
    facilityId: 'facility',
    programId: 'program',
  });
  const active = await readStockEventDraft(context);
  if (!active) throw new Error('Missing draft');
  await act(async () => {
    await archiveStockEventCopy(context, active.lines);
  });
  await user.click(await screen.findByRole('button', { name: 'Archived Copies' }));
  const copies = await screen.findByRole('dialog', { name: 'Archived Copies' });
  const actions = () => within(copies).getByRole('button', { name: /^Actions For Copy/ });
  await user.click(actions());
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
  const deletion = await screen.findByRole('alertdialog');
  vi.spyOn(context.db.table('stockEventDrafts'), 'delete').mockRejectedValueOnce(
    new Error('storage'),
  );
  await user.click(within(deletion).getByRole('button', { name: 'Delete' }));
  await within(deletion).findByRole('alert');
  expect(within(copies).queryByRole('alert')).not.toBeInTheDocument();
  await user.click(within(deletion).getByRole('button', { name: 'Cancel' }));
  await user.click(actions());
  vi.spyOn(context.db.table('stockEventDrafts'), 'put').mockRejectedValueOnce(new Error('storage'));
  await user.click(await screen.findByRole('menuitem', { name: 'Restore' }));
  await within(copies).findByRole('alert');
  await user.click(actions());
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
  expect(
    within(await screen.findByRole('alertdialog')).queryByRole('alert'),
  ).not.toBeInTheDocument();
});

it('keeps the editor usable while the deployment time zone suspends', async () => {
  const { user } = setup(true, (client) => {
    client.removeQueries({ queryKey: deploymentTimeZoneOptions().queryKey });
    void client.prefetchQuery({
      ...deploymentTimeZoneOptions(),
      queryFn: () => new Promise<{ zone: string; read: boolean }>(() => {}),
    });
  });
  await validLine(user);
  expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
});

it('keeps an earlier unknown Issue outcome visible after a later definitive refusal', async () => {
  vi.mocked(submitStockEvent)
    .mockRejectedValueOnce(networkError())
    .mockRejectedValueOnce(httpError(400));
  const { user } = setup(true, undefined, { kind: 'issue' });
  await validIssueLine(user);
  for (let attempt = 0; attempt < 2; attempt++) {
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    const failure = await screen.findByRole('alertdialog');
    await user.click(within(failure).getByRole('button', { name: 'Close' }));
  }
  expect(screen.getByRole('alert')).toHaveTextContent(
    en['stock-events.unknown-outcome-description'],
  );
  expect(submitStockEvent).toHaveBeenCalledTimes(2);
  expect(await getLocalDb().table('stockEventQueue').count()).toBe(0);
});
