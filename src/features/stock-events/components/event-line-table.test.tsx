import { useStore } from '@tanstack/react-form';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
import { renderPage } from '@/tests/render-page';

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
  onRemove = noop,
  onSearchChange = noop,
}: {
  kind: ConfiguredEventKind;
  cards?: boolean;
  count?: number;
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
      Array.from({ length: count }, (_, index) =>
        newEventLine(
          {
            stockOnHand: 50,
            orderable: {
              id: String(index),
              productCode: `C${index}`,
              fullProductName: index === 1 ? '' : `Product ${index}`,
              dispensable: { displayUnit: 'tablet' },
              netContent: 16,
            },
            lot: null,
          },
          undefined,
          '2026-10-08',
          { kind, productHasLots: index === 1 },
        ),
      ),
    );
  }, [form, kind, count]);
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

it.each([
  ...(['adjustment', 'issue', 'receive', 'unpack'] as const).map((kind) => ({
    kind,
    cards: false,
  })),
  { kind: 'issue' as const, cards: true },
  { kind: 'unpack' as const, cards: true },
])('edits only the changed $kind quantity row with cards $cards', async ({ kind, cards }) => {
  const onRemove = vi.fn();
  renderPage(<LinesFixture kind={kind} cards={cards} onRemove={onRemove} />);
  await waitFor(() =>
    expect(document.querySelector('[name="lines[0].quantity.remainder"]')).toBeInTheDocument(),
  );
  const input = document.querySelector('[name="lines[0].quantity.remainder"]') as HTMLInputElement;
  renders.mockClear();
  fireEvent.change(input, { target: { value: '2' } });
  expect(renders).toHaveBeenCalled();
  expect(new Set(renders.mock.calls.map(([name]) => name))).toEqual(new Set(['lines[0].quantity']));
  if (cards) {
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const card = screen.getByText('Product 0 - tablet (C0)').closest('li') as HTMLLIElement;
    expect(screen.getByText('C1 - tablet (C1)')).toBeInTheDocument();
    expect(within(card).getByText('stock-events.product-has-no-lots')).toBeInTheDocument();
    expect(screen.getByText('stock-events.no-lot-defined')).toBeInTheDocument();
    expect(within(card).getByText('stock-events.pack-size')).toBeInTheDocument();
    const quantity = within(card).getByText('stock-events.quantity');
    expect(quantity.parentElement?.querySelector('[name="lines[0].quantity.remainder"]')).toBe(
      input,
    );
    expect(
      quantity.compareDocumentPosition(within(card).getByText('stock-events.total-quantity')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'stock-events.field-of' }));
    expect(onRemove).toHaveBeenCalledOnce();
  } else {
    expect(screen.getByRole('table')).toBeInTheDocument();
  }
  if (kind === 'issue' && cards) {
    const card = screen.getByText('Product 0 - tablet (C0)').closest('li') as HTMLLIElement;
    const destination = within(card)
      .getByText('stock-events.issue-to')
      .closest('.justify-between') as HTMLElement;
    expect(within(destination).getByRole('combobox')).toBeInTheDocument();
  }
  if (kind === 'unpack' && cards)
    expect(screen.queryByText('stock-events.reason')).not.toBeInTheDocument();
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

it('keeps full Issue comment headers without truncation or hover text', async () => {
  function Fixture() {
    const form = useEventForm({
      kind: 'issue',
      reasons: [],
      today: '2026-10-09',
      onValid: vi.fn(),
      onInvalid: vi.fn(),
    });
    return (
      <EventLineTable
        kind="issue"
        reasonRequired
        form={form}
        lines={[]}
        reasons={[]}
        unit="PACKS"
        today="2026-10-09"
        disabled={false}
        onRemove={vi.fn()}
        search={{}}
        onSearchChange={vi.fn()}
        columnVisibility={{}}
        onClearFilter={vi.fn()}
      />
    );
  }
  renderPage(<Fixture />);
  for (const key of ['destination-comments', 'reason-comments']) {
    const header = await screen.findByRole('columnheader', { name: `stock-events.${key}` });
    expect(header.querySelector('.truncate')).toBeNull();
    expect(header.querySelector('[title]')).toBeNull();
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
