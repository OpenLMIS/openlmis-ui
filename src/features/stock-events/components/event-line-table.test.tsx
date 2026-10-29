import { useStore } from '@tanstack/react-form';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import type { EventSearch } from '@/features/stock-events/components/event-editor';
import { EventLineTable } from '@/features/stock-events/components/event-line-table';
import { useEventForm } from '@/features/stock-events/hooks/use-event-form';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import type { SearchChange } from '@/lib/table-search';
import { renderPage } from '@/test-utils/render-page';

const renders = vi.hoisted(() => vi.fn());
vi.mock('@/components/form/form-fields', async (load) => {
  const actual = await load<typeof import('@/components/form/form-fields')>();
  const { useFieldContext } = await import('@/components/form/form-context');
  return {
    ...actual,
    QuantityField: (props: Parameters<typeof actual.QuantityField>[0]) => {
      renders(useFieldContext().name);
      return <actual.QuantityField {...props} />;
    },
  };
});
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
const noReasons: never[] = [];
const noop = () => {};

function LinesFixture({
  kind,
  cards = false,
  count = 10,
  stockProblem,
  onRemove = noop,
  onSearchChange = noop,
}: {
  kind: ConfiguredEventKind;
  cards?: boolean;
  count?: number;
  stockProblem?: 'missing';
  onRemove?: (key: string) => void;
  onSearchChange?: SearchChange<EventSearch>;
}) {
  const [search, setSearch] = useState<EventSearch>({ size: 10 });
  const form = useEventForm({
    kind,
    reasons: noReasons,
    today: '2026-10-08',
    onValid: vi.fn(),
    onInvalid: vi.fn(),
  });
  useEffect(() => {
    form.setFieldValue(
      'lines',
      Array.from({ length: count }, (_, index) => ({
        ...newEventLine(
          {
            stockOnHand: 50,
            orderable: {
              id: String(index),
              productCode: `C${index}`,
              fullProductName: `Product ${index}`,
              dispensable: { displayUnit: 'tablet' },
              netContent: 16,
            },
            lot: null,
          },
          undefined,
          '2026-10-08',
          { kind, productHasLots: false },
        ),
        stockProblem,
      })),
    );
  }, [form, kind, count, stockProblem]);
  const lines = useStore(form.store, (state) => state.values.lines);
  return (
    <EventLineTable
      kind={kind}
      cards={cards}
      reasonRequired
      form={form}
      lines={lines}
      reasons={noReasons}
      unit="PACKS"
      today="2026-10-08"
      disabled={false}
      onRemove={onRemove}
      search={search}
      onSearchChange={(update, replace, navigation) => {
        onSearchChange(update, replace, navigation);
        setSearch((old) => ({ ...old, ...(typeof update === 'function' ? update(old) : update) }));
      }}
      columnVisibility={{}}
      onClearFilter={vi.fn()}
    />
  );
}

it.each(['adjustment', 'issue', 'receive', 'unpack'] as const)(
  'renders only the changed quantity row out of 10 visible %s rows',
  async (kind) => {
    renderPage(<LinesFixture kind={kind} />);
    await waitFor(() =>
      expect(document.querySelector('[name="lines[0].quantity.remainder"]')).toBeInTheDocument(),
    );
    renders.mockClear();
    fireEvent.change(
      document.querySelector('[name="lines[0].quantity.remainder"]') as HTMLInputElement,
      { target: { value: '2' } },
    );
    expect(renders).toHaveBeenCalled();
    expect(new Set(renders.mock.calls.map(([name]) => name))).toEqual(
      new Set(['lines[0].quantity']),
    );
    expect(screen.getAllByRole('row')).toHaveLength(11);
  },
);

it('shows an issue line as a card with its details and a Remove action', async () => {
  const i18n = createInstance();
  await i18n.use(ICU).init({
    lng: 'en',
    resources: { en: { translation: en } },
    keySeparator: false,
  });
  const onRemove = vi.fn();
  const user = userEvent.setup();
  renderPage(
    <I18nextProvider i18n={i18n}>
      <LinesFixture kind="issue" cards count={1} onRemove={onRemove} />
    </I18nextProvider>,
  );
  const card = await screen.findByRole('listitem');
  const row = 'Product 0 Product Has No Lots, Line 1';
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(within(card).getByText('Product 0 - tablet (C0)')).toBeInTheDocument();
  for (const label of ['Pack Size', 'Lot Code', 'Stock On Hand', 'Total Quantity'])
    expect(within(card).getByText(label)).toBeInTheDocument();
  expect(within(card).getByRole('combobox', { name: `Issue To, ${row}` })).toBeInTheDocument();
  expect(within(card).getByRole('combobox', { name: `Reason, ${row}` })).toBeInTheDocument();
  expect(within(card).getByRole('textbox', { name: `Quantity, ${row} Packs` })).toBeInTheDocument();
  await user.click(within(card).getByRole('button', { name: `Remove, ${row}` }));
  expect(onRemove).toHaveBeenCalledOnce();
});

it('scrolls to the card list on page two and preserves router scroll', async () => {
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  try {
    const onSearchChange = vi.fn();
    renderPage(<LinesFixture kind="issue" cards count={11} onSearchChange={onSearchChange} />);
    await screen.findByText('Product 0 - tablet (C0)');
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    await screen.findByText('Product 10 - tablet (C10)');
    expect(onSearchChange).toHaveBeenCalledWith(expect.anything(), undefined, {
      resetScroll: false,
    });
    expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    expect(scroll.mock.contexts.at(-1)).toBe(screen.getByRole('list'));
  } finally {
    HTMLElement.prototype.scrollIntoView = originalScroll;
  }
});

it.each([false, true])(
  'distinguishes duplicate draft lines after paging with product lots %s',
  async (hasProductLots) => {
    const i18n = createInstance();
    await i18n.use(ICU).init({
      lng: 'en',
      resources: { en: { translation: en } },
      keySeparator: false,
    });
    const card = {
      stockOnHand: 50,
      orderable: { id: 'product', productCode: 'C1', fullProductName: 'HUMATROPE' },
      lot: null,
    };
    const seeded = Array.from({ length: 12 }, () =>
      newEventLine(card, undefined, '2026-10-09', {
        kind: 'issue',
        productHasLots: hasProductLots,
      }),
    );
    function Fixture() {
      const form = useEventForm({
        kind: 'issue',
        reasons: [],
        today: '2026-10-09',
        onValid: vi.fn(),
        onInvalid: vi.fn(),
      });
      useEffect(() => {
        form.setFieldValue('lines', seeded);
      }, [form]);
      const lines = useStore(form.store, (state) => state.values.lines);
      return (
        <EventLineTable
          kind="issue"
          reasonRequired={false}
          form={form}
          lines={lines}
          reasons={[]}
          unit="DOSES"
          today="2026-10-09"
          disabled={false}
          onRemove={vi.fn()}
          search={{ page: 2, size: 10 }}
          onSearchChange={vi.fn()}
          columnVisibility={{}}
          onClearFilter={vi.fn()}
        />
      );
    }
    renderPage(
      <I18nextProvider i18n={i18n}>
        <Fixture />
      </I18nextProvider>,
    );
    const message = hasProductLots ? 'No Lot Defined' : 'Product Has No Lots';
    for (const position of [11, 12]) {
      const input = await screen.findByRole('combobox', {
        name: `Issue To, HUMATROPE ${message}, Line ${position}`,
      });
      expect(input).toHaveTextContent('Select An Option');
      expect(
        within(input.closest('tr') as HTMLTableRowElement).getByText(message),
      ).toBeInTheDocument();
    }
  },
);

it.each([false, true])(
  'explains restored stock problems before submit (cards: %s)',
  async (cards) => {
    renderPage(<LinesFixture kind="adjustment" cards={cards} count={1} stockProblem="missing" />);
    const note = await screen.findByText('stock-events.draft-stock-unavailable');
    expect(note).toBeVisible();
    const product = screen.getByText(cards ? 'Product 0 - tablet (C0)' : 'Product 0 - tablet');
    expect(product.closest('[aria-describedby]')).toHaveAccessibleDescription(
      'stock-events.draft-stock-unavailable',
    );
    expect(document.querySelector('tr[aria-invalid]')).not.toBeInTheDocument();
  },
);
