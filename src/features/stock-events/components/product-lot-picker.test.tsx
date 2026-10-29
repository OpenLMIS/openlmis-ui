import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { FormMessagesProvider } from '@/components/form/form-messages';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchApprovedProducts,
  fetchFacilityOrderableFulfills,
  fetchLotsByTradeItems,
  fetchOrderablesByIds,
} from '@/features/reference-data/api/api';
import type { Orderable } from '@/features/reference-data/lib/types';
import { fetchEventStockOnHand } from '@/features/stock-events/api/api';
import {
  eventStockCardsOptions,
  type ReceiveDevice,
  receiveDevice,
} from '@/features/stock-events/api/queries';
import {
  ProductLotPicker,
  ProductLotPickerSkeleton,
} from '@/features/stock-events/components/product-lot-picker';
import { allEventCards, kitCards } from '@/features/stock-events/lib/products';
import type { EventLot, EventStockCard } from '@/features/stock-events/lib/types';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { offlineAccessFixture } from '@/test-utils/offline-access';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/features/reference-data/api/api', () => ({
  fetchApprovedProducts: vi.fn(),
  fetchFacilityOrderableFulfills: vi.fn(),
  fetchLotsByTradeItems: vi.fn(),
  fetchOrderablesByIds: vi.fn(),
}));
vi.mock('@/features/stock-events/api/api', () => ({
  fetchEventStockOnHand: vi.fn(),
  fetchEventStockCards: vi.fn(),
}));

const i18n = createInstance();
beforeAll(() =>
  i18n.use(ICU).init({ lng: 'en', resources: { en: { translation: en } }, keySeparator: false }),
);
const card: EventStockCard = {
  id: 'card',
  stockOnHand: 50,
  orderable: { id: 'product', productCode: 'C1', fullProductName: 'Aspirin', netContent: 16 },
  lot: { id: 'lot', lotCode: 'LOT', expirationDate: null },
};

describe('ProductLotPicker', () => {
  it('keeps the product field label while announcing loading only to screen readers', async () => {
    renderPage(
      <I18nextProvider i18n={i18n}>
        <ProductLotPickerSkeleton kind="receive" />
      </I18nextProvider>,
    );
    const label = await screen.findByText('Product');
    expect(label).toBeVisible();
    expect(label.parentElement).toHaveTextContent('*');
    expect(screen.getByRole('combobox', { name: 'Lot Code' })).toBeDisabled();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(en['stock-events.products-loading']);
    expect(status).toHaveClass('sr-only');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it.each([true, false])('requires an explicit lot choice with no-lot option %s', async (noLot) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(
      eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
      {
        cards: [
          card,
          {
            ...card,
            id: 'ibuprofen',
            lot: null,
            orderable: { ...card.orderable, id: 'ibuprofen', fullProductName: 'Ibuprofen' },
          },
          {
            ...card,
            id: 'other',
            lot: noLot ? null : { id: 'other-lot', lotCode: 'OTHER', expirationDate: null },
          },
        ],
        device: undefined,
      },
    );
    const onAdd = vi.fn();
    const user = userEvent.setup();
    renderPage(
      <I18nextProvider i18n={i18n}>
        <ProductLotPicker
          kind="adjustment"
          facilityId="facility"
          programId="program"
          disabled={false}
          cardFilter={allEventCards}
          onAdd={onAdd}
        />
      </I18nextProvider>,
      { queryClient },
    );
    const product = await screen.findByRole('combobox', { name: 'Product' });
    expect(screen.getByRole('combobox', { name: 'Lot Code' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await user.click(product);
    await user.click(await screen.findByRole('option', { name: 'Aspirin' }));
    const lot = screen.getByRole('combobox', { name: 'Lot Code' });
    const add = screen.getByRole('button', { name: 'Add' });
    expect(lot).toHaveTextContent('Lot Code');
    expect(add).toBeDisabled();
    await user.click(add);
    expect(onAdd).not.toHaveBeenCalled();
    await user.click(lot);
    await user.click(await screen.findByRole('option', { name: noLot ? 'No Lot Defined' : 'LOT' }));
    expect(add).toBeEnabled();
    await user.click(add);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ lot: noLot ? null : card.lot }),
      true,
    );
    await user.click(product);
    await user.click(await screen.findByRole('option', { name: 'Ibuprofen' }));
    expect(lot).toBeDisabled();
    expect(lot).toHaveTextContent('Product Has No Lots');
    expect(add).toBeEnabled();
  });
});

it.each([true, false])(
  'picks the sole offered product and lot, including no-lot %s',
  async (noLot) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const offered = { ...card, lot: noLot ? null : card.lot };
    queryClient.setQueryData(
      eventStockCardsOptions({ facilityId: 'facility', programId: 'program' }).queryKey,
      {
        cards: [
          offered,
          { ...card, orderable: { ...card.orderable, id: 'hidden', fullProductName: 'Hidden' } },
        ],
        device: undefined,
      },
    );
    const onAdd = vi.fn();
    const user = userEvent.setup();
    renderPage(
      <I18nextProvider i18n={i18n}>
        <ProductLotPicker
          kind="adjustment"
          facilityId="facility"
          programId="program"
          disabled={false}
          cardFilter={(cards) => cards.filter((item) => item.orderable.id !== 'hidden')}
          onAdd={onAdd}
        />
      </I18nextProvider>,
      { queryClient },
    );
    expect(await screen.findByRole('combobox', { name: 'Product' })).toHaveValue('Aspirin');
    expect(screen.queryByText('Product') === null).toBe(noLot);
    if (noLot) expect(screen.queryByRole('combobox', { name: 'Lot Code' })).not.toBeInTheDocument();
    else expect(screen.getByRole('combobox', { name: 'Lot Code' })).toHaveTextContent('LOT');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith(offered, !noLot);
    await user.click(screen.getByRole('combobox', { name: 'Product' }));
    expect(screen.queryByRole('option', { name: 'Hidden' })).not.toBeInTheDocument();
  },
);

it('keeps an automatically picked lot when a refresh adds another option', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const queryKey = eventStockCardsOptions({
    facilityId: 'facility',
    programId: 'program',
  }).queryKey;
  queryClient.setQueryData(queryKey, { cards: [card], device: undefined });
  const onAdd = vi.fn();
  const user = userEvent.setup();
  renderPage(
    <I18nextProvider i18n={i18n}>
      <ProductLotPicker
        kind="adjustment"
        facilityId="facility"
        programId="program"
        disabled={false}
        cardFilter={allEventCards}
        onAdd={onAdd}
      />
    </I18nextProvider>,
    { queryClient },
  );
  expect(await screen.findByRole('combobox', { name: 'Product' })).toHaveValue('Aspirin');
  expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  await act(async () =>
    queryClient.setQueryData(queryKey, {
      cards: [card, { ...card, lot: { id: 'other', lotCode: 'OTHER', expirationDate: null } }],
      device: undefined,
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(onAdd).toHaveBeenCalledWith(card, true);
});

const aspirin: Orderable = {
  id: 'aspirin',
  productCode: 'C1',
  fullProductName: 'Aspirin',
  description: null,
  netContent: 16,
  identifiers: { tradeItem: 'trade' },
};
const ibuprofen: Orderable = {
  id: 'ibuprofen',
  productCode: 'C2',
  fullProductName: 'Ibuprofen',
  description: null,
  netContent: 1,
};
const generic: Orderable = { ...aspirin, id: 'generic', fullProductName: 'Salicylate' };
const existingLot = {
  id: 'lot-a',
  lotCode: 'LOT-A',
  expirationDate: '2030-01-01',
  tradeItemId: 'trade',
};
const approvedPage = (orderables: Orderable[], totalElements = orderables.length) => ({
  content: orderables.map((orderable) => ({ id: `approved-${orderable.id}`, orderable })),
  totalElements,
  totalPages: Math.ceil(totalElements / 100),
  number: 0,
  size: 100,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderApproved({
  canManageLots = false,
  lines = [],
  device = receiveDevice({ facilityId: 'facility', programId: 'program' }, 'type', true),
  cards = false,
}: {
  device?: ReceiveDevice;
  cards?: boolean;
  canManageLots?: boolean;
  lines?: { key: string; lot: EventLot | null }[];
} = {}) {
  const onAdd = vi.fn();
  const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, networkMode: 'always' } },
  });
  renderPage(
    <I18nextProvider i18n={i18n}>
      <FormMessagesProvider formatError={(key) => i18n.t(key, { defaultValue: key })}>
        <form onSubmit={onSubmit}>
          <ProductLotPicker
            kind="receive"
            from="approved-products"
            device={device}
            facilityId="facility"
            programId="program"
            disabled={false}
            canManageLots={canManageLots}
            lines={lines}
            onAdd={onAdd}
            cards={cards}
          />
        </form>
      </FormMessagesProvider>
    </I18nextProvider>,
    { queryClient },
  );
  return { onAdd, onSubmit, queryClient, user: userEvent.setup() };
}

async function productBox() {
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Product' })).toBeEnabled());
  return screen.getByRole('combobox', { name: 'Product' });
}

async function pickProduct(user: ReturnType<typeof userEvent.setup>, name: string | RegExp) {
  await user.click(await productBox());
  await user.click(await screen.findByRole('option', { name }));
}

describe('ProductLotPicker with approved products', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchApprovedProducts).mockImplementation(async ({ name }) =>
      name ? approvedPage([ibuprofen], 1) : approvedPage([aspirin, ibuprofen], 120),
    );
    vi.mocked(fetchFacilityOrderableFulfills).mockResolvedValue({});
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([]);
    vi.mocked(fetchLotsByTradeItems).mockResolvedValue([existingLot]);
    vi.mocked(fetchEventStockOnHand).mockResolvedValue({ 'aspirin/lot-a': 40 });
  });

  it('searches and pages the offline catalog, adds stockless products and checks queued new lots', async () => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'owner', username: 'Ada', accessToken: 'token' });
    const db = getLocalDb();
    await db.table(LOCAL_TABLES.stockEventQueue).clear();
    const products = Array.from({ length: 120 }, (_, index) => ({
      id: `product-${index}`,
      productCode: `P${index}`,
      fullProductName: `Product ${String(index).padStart(3, '0')}`,
      description: null,
      netContent: 1,
      identifiers: { tradeItem: `trade-${index}` },
    }));
    const scope = {
      facilityId: 'facility',
      facilityTypeId: 'type',
      programId: 'program',
      userId: 'owner',
      generation: 'download',
      fetchedAt: Date.now(),
      scanning: false,
    };
    await db.table(LOCAL_TABLES.offlineAccess).put(
      offlineAccessFixture({
        userId: 'owner',
        home: { id: 'facility' },
        programs: [{ id: 'program', code: 'P', name: 'Program', active: true }],
        rights: [
          'STOCK_ADJUST|facility|program',
          'STOCK_CARDS_VIEW|facility|program',
          'LOTS_MANAGE',
        ],
      }),
    );
    await db.table(LOCAL_TABLES.homeStockDownloads).put({
      ...scope,
      formatVersion: 6,
      cards: [],
      reasons: [],
      tradeItems: [],
      identities: [],
      summaries: [],
      products: [],
      sources: [],
      destinations: [],
    });
    await db.table(LOCAL_TABLES.receiveCatalogDownloads).put({
      ...scope,
      formatVersion: 1,
      approved: products.map(({ id }) => ({ id, versionNumber: null })),
      products,
      lots: [],
      tradeItems: [],
      fulfils: {},
    });
    await db.table(LOCAL_TABLES.stockEventQueue).put({
      localEventId: 'queued',
      userId: 'owner',
      lines: [
        { lot: { lotCode: 'NEW-1', expirationDate: '2030-01-01', tradeItemId: 'trade-119' } },
      ],
    });
    onlineManager.setOnline(false);
    const { user, onAdd } = renderApproved({
      canManageLots: true,
      device: receiveDevice({ facilityId: 'facility', programId: 'program' }, 'type', false),
    });
    const product = await productBox();
    await user.click(product);
    await screen.findByRole('option', { name: 'Product 000' });
    expect(screen.queryByRole('option', { name: 'Product 119' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Show More' }));
    await screen.findByRole('option', { name: 'Product 119' });
    expect(screen.getByRole('option', { name: 'Product 000' })).toBeInTheDocument();
    await user.type(product, 'PRODUCT 119');
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'Product 000' })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('option', { name: 'Product 119' }));
    await user.click(await screen.findByRole('combobox', { name: 'Lot Code' }));
    await user.click(await screen.findByRole('option', { name: 'No Lot Defined' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith(
      { orderable: products[119], lot: null, stockOnHand: null },
      false,
    );
    await user.click(screen.getByRole('combobox', { name: 'Lot Code' }));
    await user.click(screen.getByRole('option', { name: 'Add New Lot' }));
    await user.type(screen.getByRole('textbox', { name: 'New Lot Code' }), 'new-1');
    await user.click(screen.getByRole('button', { name: 'Expiry Date Pick A Date' }));
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Choose the Year' }),
      '2031',
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Choose the Month' }), '0');
    await user.click(screen.getByRole('button', { name: /January 1st, 2031/ }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('textbox', { name: 'New Lot Code' })).toHaveAccessibleDescription(
      'Another receipt on this device already uses this lot code with expiry Jan 1, 2030.',
    );
    expect(fetchApprovedProducts).not.toHaveBeenCalled();
  });

  it('distinguishes no approved products from a server search with no matches', async () => {
    vi.mocked(fetchApprovedProducts).mockResolvedValue(approvedPage([]));
    const { user } = renderApproved();
    const product = await productBox();
    await user.click(product);
    expect(
      await screen.findByText('No products are approved for this program at this facility.'),
    ).toBeVisible();
    expect(screen.queryByText(en['stock-events.no-matches-title'])).not.toBeInTheDocument();
    await user.type(product, 'missing');
    await waitFor(() =>
      expect(fetchApprovedProducts).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'missing' }),
      ),
    );
    expect(await screen.findByText(en['stock-events.no-matches-title'])).toBeVisible();
    expect(
      screen.queryByText('No products are approved for this program at this facility.'),
    ).not.toBeInTheDocument();
  });

  it('searches by name, reports the count and keeps the picked product across searches', async () => {
    const { user, onAdd } = renderApproved();
    const product = await productBox();
    await user.click(product);
    expect(await screen.findByText('Showing 2 of 120. Type to search.')).toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Aspirin' }));
    await user.type(product, 'ibu', {
      initialSelectionStart: 0,
      initialSelectionEnd: 'Aspirin'.length,
    });
    await waitFor(() =>
      expect(fetchApprovedProducts).toHaveBeenCalledWith({
        facilityId: 'facility',
        programId: 'program',
        name: 'ibu',
        page: 0,
        size: 100,
      }),
    );
    expect(await screen.findByRole('option', { name: 'Ibuprofen' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Aspirin' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('combobox', { name: 'Lot Code' }));
    await user.click(await screen.findByRole('option', { name: /^LOT-A/ }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith(
      { orderable: aspirin, lot: existingLot, stockOnHand: 40 },
      true,
    );
  });

  it('loads the next page from Show More', async () => {
    vi.mocked(fetchApprovedProducts).mockImplementation(async ({ page }) =>
      page === 0 ? approvedPage([aspirin], 2) : { ...approvedPage([ibuprofen], 2), number: page },
    );
    const { user } = renderApproved();
    await user.click(await productBox());
    await screen.findByRole('option', { name: 'Aspirin' });
    expect(screen.queryByRole('option', { name: 'Ibuprofen' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Show More' }));
    expect(await screen.findByRole('option', { name: 'Ibuprofen' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Aspirin' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Show More' })).not.toBeInTheDocument();
  });

  it('offers Retry when a further page fails to load', async () => {
    vi.mocked(fetchApprovedProducts)
      .mockResolvedValueOnce(approvedPage([aspirin], 2))
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValue({ ...approvedPage([ibuprofen], 2), number: 1 });
    const { user } = renderApproved();
    await user.click(await productBox());
    await user.click(await screen.findByRole('option', { name: 'Show More' }));
    expect(await screen.findByText(en['stock-events.show-more-error'])).toHaveAttribute(
      'aria-live',
      'polite',
    );
    await user.click(await screen.findByRole('option', { name: 'Try Again' }));
    expect(await screen.findByRole('option', { name: 'Ibuprofen' })).toBeInTheDocument();
    expect(screen.queryByText(en['stock-events.show-more-error'])).not.toBeInTheDocument();
  });

  it('keeps loaded lots and stock on hand usable when a refresh fails', async () => {
    const { user, queryClient } = renderApproved();
    await pickProduct(user, 'Aspirin');
    await user.click(await screen.findByRole('combobox', { name: 'Lot Code' }));
    await user.click(await screen.findByRole('option', { name: /^LOT-A/ }));
    vi.mocked(fetchLotsByTradeItems).mockRejectedValue(new Error('Unavailable'));
    vi.mocked(fetchEventStockOnHand).mockRejectedValue(new Error('Unavailable'));
    await act(async () => queryClient.refetchQueries());
    await act(() => new Promise((done) => setTimeout(done)));
    expect(screen.getByRole('combobox', { name: 'Lot Code' })).toBeEnabled();
    expect(screen.queryByText(en['stock-events.lots-error-title'])).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  it('preloads lots and stock on hand for the listed products, so a pick is ready at once', async () => {
    vi.mocked(fetchLotsByTradeItems)
      .mockResolvedValueOnce([existingLot])
      .mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchEventStockOnHand)
      .mockResolvedValueOnce({ 'aspirin/lot-a': 40 })
      .mockReturnValue(new Promise(() => {}));
    const { user, onAdd } = renderApproved();
    await waitFor(() =>
      expect(fetchEventStockOnHand).toHaveBeenCalledWith({
        facilityId: 'facility',
        programId: 'program',
        orderableIds: ['aspirin', 'ibuprofen'],
      }),
    );
    expect(fetchLotsByTradeItems).toHaveBeenCalledWith(['trade']);
    await pickProduct(user, 'Aspirin');
    await user.click(screen.getByRole('combobox', { name: 'Lot Code' }));
    await user.click(await screen.findByRole('option', { name: /^LOT-A/ }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith(
      { orderable: aspirin, lot: existingLot, stockOnHand: 40 },
      true,
    );
    expect(fetchEventStockOnHand).toHaveBeenCalledTimes(1);
    expect(fetchLotsByTradeItems).toHaveBeenCalledTimes(1);
    expect(fetchEventStockOnHand).toHaveBeenCalledTimes(1);
    expect(fetchLotsByTradeItems).toHaveBeenCalledTimes(1);
  });

  it("waits for the picked product's lots and stock on hand before Add", async () => {
    const lots = deferred<(typeof existingLot)[]>();
    const stock = deferred<Record<string, number>>();
    vi.mocked(fetchLotsByTradeItems).mockReturnValue(lots.promise);
    vi.mocked(fetchEventStockOnHand).mockReturnValue(stock.promise);
    const { user, onAdd } = renderApproved();
    await pickProduct(user, 'Ibuprofen');
    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Loading Lots...');
    const lot = screen.getByRole('combobox', { name: 'Lot Code' });
    expect(lot).toBeDisabled();
    expect(fetchEventStockOnHand).toHaveBeenCalledWith({
      facilityId: 'facility',
      programId: 'program',
      orderableIds: ['aspirin', 'ibuprofen'],
    });
    await act(async () => stock.resolve({}));
    await waitFor(() => expect(add).toBeEnabled());
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(lot).toBeDisabled();
    expect(lot).toHaveTextContent('Product Has No Lots');
    await user.click(add);
    expect(onAdd).toHaveBeenCalledWith(
      { orderable: ibuprofen, lot: null, stockOnHand: null },
      false,
    );
    await pickProduct(user, 'Aspirin');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(fetchLotsByTradeItems).toHaveBeenCalledWith(['trade']);
    await act(async () => lots.resolve([existingLot]));
    await waitFor(() => expect(lot).toBeEnabled());
  });

  it.each([
    ['fulfilment map', () => vi.mocked(fetchFacilityOrderableFulfills)],
    ['fulfilling products', () => vi.mocked(fetchOrderablesByIds)],
  ])('reports and retries a failed %s load', async (_, failing) => {
    vi.mocked(fetchFacilityOrderableFulfills).mockResolvedValue({
      aspirin: { canFulfillForMe: ['generic'] },
    });
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([generic]);
    failing().mockRejectedValueOnce(new Error('Unavailable'));
    const { user } = renderApproved();
    expect(await screen.findByText(en['stock-events.fulfils-error-title'])).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() =>
      expect(screen.queryByText(en['stock-events.fulfils-error-title'])).not.toBeInTheDocument(),
    );
    await user.click(await productBox());
    expect(await screen.findByRole('option', { name: 'Salicylate' })).toBeInTheDocument();
  });

  it('retries a failed lots load', async () => {
    vi.mocked(fetchLotsByTradeItems)
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockRejectedValueOnce(new Error('Unavailable'));
    const { user } = renderApproved();
    await pickProduct(user, 'Aspirin');
    expect(await screen.findByText(en['stock-events.lots-error-title'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Lot Code' })).toBeEnabled());
    expect(screen.queryByText(en['stock-events.lots-error-title'])).not.toBeInTheDocument();
  });

  it('validates a new lot and adds it on Enter without submitting the form', async () => {
    const { user, onAdd, onSubmit } = renderApproved({
      canManageLots: true,
      lines: [
        {
          key: 'drafted',
          lot: { lotCode: 'NEW-1', expirationDate: '2031-01-01', tradeItemId: 'trade' },
        },
      ],
    });
    await pickProduct(user, 'Aspirin');
    await user.click(await screen.findByRole('combobox', { name: 'Lot Code' }));
    await user.click(await screen.findByRole('option', { name: 'Add New Lot' }));
    expect(screen.getByRole('button', { name: 'Expiry Date Pick A Date' })).toBeInTheDocument();
    const code = screen.getByRole('textbox', { name: 'New Lot Code' });
    await user.type(code, '{Enter}');
    expect(code).toHaveAccessibleDescription('This field is required');
    await user.type(code, 'lot-a{Enter}');
    expect(code).toHaveAccessibleDescription('This lot code already exists.');
    await user.clear(code);
    await user.type(code, 'new-1{Enter}');
    expect(code).toHaveAccessibleDescription('This lot code already exists.');
    await user.clear(code);
    await user.type(code, 'NEW-2{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onAdd).toHaveBeenCalledWith(
      {
        orderable: aspirin,
        lot: { lotCode: 'NEW-2', expirationDate: null, tradeItemId: 'trade' },
        stockOnHand: 0,
      },
      true,
    );
    expect(code).toHaveValue('NEW-2');
    expect(code).not.toHaveAttribute('aria-invalid');
  });

  it('adds a new lot through a dialog on phones and keeps the previous lot on Cancel', async () => {
    const { user, onAdd, onSubmit } = renderApproved({ canManageLots: true, cards: true });
    await pickProduct(user, 'Aspirin');
    const lot = await screen.findByRole('combobox', { name: 'Lot Code' });
    await user.click(lot);
    await user.click(await screen.findByRole('option', { name: 'Add New Lot' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add New Lot' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(lot).toHaveTextContent('Lot Code');
    await waitFor(() => expect(lot).toHaveFocus());
    expect(screen.queryByRole('textbox', { name: 'New Lot Code' })).not.toBeInTheDocument();
    await user.click(lot);
    await user.click(await screen.findByRole('option', { name: 'Add New Lot' }));
    const reopened = await screen.findByRole('dialog', { name: 'Add New Lot' });
    const code = within(reopened).getByRole('textbox', { name: 'New Lot Code' });
    await user.type(code, 'lot-a{Enter}');
    expect(code).toHaveAccessibleDescription('This lot code already exists.');
    await user.clear(code);
    await user.type(code, 'NEW-2');
    await user.click(within(reopened).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(lot).toHaveTextContent('NEW-2');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onAdd).toHaveBeenCalledWith(
      {
        orderable: aspirin,
        lot: { lotCode: 'NEW-2', expirationDate: null, tradeItemId: 'trade' },
        stockOnHand: 0,
      },
      true,
    );
  });

  it('lists a fulfilling product once the fulfilment map loads, also by its own name', async () => {
    const fulfils = deferred<Record<string, { canFulfillForMe: string[] }>>();
    vi.mocked(fetchFacilityOrderableFulfills).mockReturnValue(fulfils.promise);
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([generic]);
    vi.mocked(fetchApprovedProducts).mockImplementation(async ({ name }) =>
      name ? approvedPage([]) : approvedPage([aspirin, ibuprofen]),
    );
    const { user, onAdd } = renderApproved();
    const product = await productBox();
    await user.click(product);
    await screen.findByRole('option', { name: 'Aspirin' });
    expect(screen.queryByRole('option', { name: 'Salicylate' })).not.toBeInTheDocument();
    await act(async () => fulfils.resolve({ aspirin: { canFulfillForMe: ['generic'] } }));
    await screen.findByRole('option', { name: 'Salicylate' });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Salicylate',
      'Aspirin',
      'Ibuprofen',
    ]);
    await user.type(product, 'salic');
    await waitFor(() =>
      expect(fetchApprovedProducts).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'salic' }),
      ),
    );
    await waitFor(() =>
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Salicylate',
      ]),
    );
    await user.click(screen.getByRole('option', { name: 'Salicylate' }));
    await waitFor(() =>
      expect(fetchEventStockOnHand).toHaveBeenCalledWith(
        expect.objectContaining({ orderableIds: ['aspirin'] }),
      ),
    );
    await user.click(await screen.findByRole('combobox', { name: 'Lot Code' }));
    await user.click(await screen.findByRole('option', { name: 'No Lot Defined' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith({ orderable: generic, lot: null, stockOnHand: null }, true);
  });

  it('keeps the sole approved product and a typed new lot when fulfilling products load', async () => {
    const fulfils = deferred<Record<string, { canFulfillForMe: string[] }>>();
    vi.mocked(fetchFacilityOrderableFulfills).mockReturnValue(fulfils.promise);
    vi.mocked(fetchOrderablesByIds).mockResolvedValue([generic]);
    vi.mocked(fetchApprovedProducts).mockResolvedValue(approvedPage([aspirin]));
    const { user } = renderApproved({ canManageLots: true });
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Product' })).toHaveValue('Aspirin'),
    );
    await user.click(await screen.findByRole('combobox', { name: 'Lot Code' }));
    await user.click(await screen.findByRole('option', { name: 'Add New Lot' }));
    await user.type(screen.getByRole('textbox', { name: 'New Lot Code' }), 'NEW-1');
    await act(async () => fulfils.resolve({ aspirin: { canFulfillForMe: ['generic'] } }));
    await waitFor(() => expect(fetchOrderablesByIds).toHaveBeenCalled());
    await user.click(screen.getByRole('combobox', { name: 'Product' }));
    await screen.findByRole('option', { name: 'Salicylate' });
    await user.keyboard('{Escape}');
    expect(screen.getByRole('combobox', { name: 'Product' })).toHaveValue('Aspirin');
    expect(screen.getByRole('combobox', { name: 'Lot Code' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'New Lot Code' })).toHaveValue('NEW-1');
  });

  it('retries a failed product search', async () => {
    vi.mocked(fetchApprovedProducts)
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValue(approvedPage([aspirin]));
    const { user } = renderApproved();
    expect(
      await screen.findByText(en['stock-events.products-search-error-title']),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Product' })).toHaveValue('Aspirin'),
    );
  });
});

it('distinguishes an empty kit list from a search with no matching kits', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const queryKey = eventStockCardsOptions({
    facilityId: 'facility',
    programId: 'program',
  }).queryKey;
  queryClient.setQueryData(queryKey, { cards: [card], device: undefined });
  const user = userEvent.setup();
  renderPage(
    <I18nextProvider i18n={i18n}>
      <ProductLotPicker
        kind="unpack"
        facilityId="facility"
        programId="program"
        disabled={false}
        cardFilter={kitCards}
        onAdd={vi.fn()}
      />
    </I18nextProvider>,
    { queryClient },
  );
  const picker = await screen.findByRole('combobox', { name: 'Kit' });
  await user.click(picker);
  expect(await screen.findByText('No kits with stock in this program.')).toBeVisible();
  expect(screen.queryByText(en['stock-events.no-matches-title'])).not.toBeInTheDocument();
  await act(async () =>
    queryClient.setQueryData(queryKey, {
      cards: [
        {
          ...card,
          lot: null,
          orderable: { ...card.orderable, children: [{ orderable: { id: 'child' }, quantity: 1 }] },
        },
      ],
      device: undefined,
    }),
  );
  await user.clear(picker);
  await user.type(picker, 'missing kit');
  expect(await screen.findByText(en['stock-events.no-matches-title'])).toBeVisible();
  expect(screen.queryByText('No kits with stock in this program.')).not.toBeInTheDocument();
});
