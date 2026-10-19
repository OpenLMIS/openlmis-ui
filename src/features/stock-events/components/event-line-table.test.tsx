import { useStore } from '@tanstack/react-form';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { EventLineTable } from '@/features/stock-events/components/event-line-table';
import { useEventForm } from '@/features/stock-events/hooks/use-event-form';
import { newEventLine } from '@/features/stock-events/lib/event-form';
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
it.each(
  (['adjustment', 'issue', 'receive', 'unpack'] as const).flatMap((kind) =>
    [false, true].map((cards) => ({ kind, cards })),
  ),
)('edits only the changed $kind quantity row with cards $cards', async ({ kind, cards }) => {
  const seeded = Array.from({ length: 10 }, (_, index) =>
    newEventLine(
      {
        stockOnHand: 50,
        orderable: {
          id: String(index),
          productCode: `C${index}`,
          fullProductName: `Product ${index}`,
          netContent: 16,
        },
        lot: null,
      },
      undefined,
      '2026-10-08',
      { kind, productHasLots: false },
    ),
  );
  const reasons: never[] = [];
  const onRemove = vi.fn();
  const onSearchChange = vi.fn();
  function Fixture() {
    const form = useEventForm({
      kind,
      reasons,
      today: '2026-10-08',
      onValid: vi.fn(),
      onInvalid: vi.fn(),
    });
    useEffect(() => {
      form.setFieldValue('lines', seeded);
    }, [form]);
    const lines = useStore(form.store, (state) => state.values.lines);
    return (
      <EventLineTable
        kind={kind}
        cards={cards}
        reasonRequired
        form={form}
        lines={lines}
        reasons={reasons}
        unit="DOSES"
        today="2026-10-08"
        disabled={false}
        onRemove={onRemove}
        search={{ size: 10 }}
        onSearchChange={onSearchChange}
        columnVisibility={{}}
        onClearFilter={vi.fn()}
      />
    );
  }
  renderPage(<Fixture />);
  await waitFor(() =>
    expect(document.querySelector('[name="lines[0].quantity.doses"]')).toBeInTheDocument(),
  );
  renders.mockClear();
  fireEvent.change(document.querySelector('[name="lines[0].quantity.doses"]') as HTMLInputElement, {
    target: { value: '2' },
  });
  expect(renders).toHaveBeenCalled();
  expect(new Set(renders.mock.calls.map(([name]) => name))).toEqual(new Set(['lines[0].quantity']));
  expect(screen.getAllByRole('textbox')).toHaveLength(10);
  if (cards) {
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const card = screen.getByText('Product 0 (C0)').closest('li') as HTMLLIElement;
    expect(within(card).getByText('stock-events.pack-size')).toBeInTheDocument();
    expect(within(card).getByText('stock-events.stock-on-hand')).toBeInTheDocument();
    expect(within(card).getByRole('textbox')).toHaveValue('2');
    fireEvent.click(within(card).getByRole('button', { name: 'stock-events.field-of' }));
    expect(onRemove).toHaveBeenCalledWith(seeded[0].key);
  } else {
    expect(screen.getByRole('table')).toBeInTheDocument();
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
