import { useStore } from '@tanstack/react-form';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
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
it('renders only the changed quantity row out of 10 visible rows', async () => {
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
      { kind: 'adjustment' },
    ),
  );
  const reasons: never[] = [];
  const onRemove = vi.fn();
  const onSearchChange = vi.fn();
  function Fixture() {
    const form = useEventForm({
      kind: 'adjustment',
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
        kind="adjustment"
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
});

it('renders Issue headers with the same label output as Adjustments', async () => {
  function Fixture({ kind }: { kind: 'issue' | 'adjustment' }) {
    const form = useEventForm({
      kind,
      reasons: [],
      today: '2026-10-08',
      onValid: vi.fn(),
      onInvalid: vi.fn(),
    });
    return (
      <EventLineTable
        kind={kind}
        reasonRequired
        form={form}
        lines={[]}
        reasons={[]}
        unit="DOSES"
        today="2026-10-08"
        disabled={false}
        onRemove={vi.fn()}
        search={{}}
        onSearchChange={vi.fn()}
        columnVisibility={{}}
        onClearFilter={vi.fn()}
      />
    );
  }
  renderPage(
    <>
      <section aria-label="Adjustments">
        <Fixture kind="adjustment" />
      </section>
      <section aria-label="Issue">
        <Fixture kind="issue" />
      </section>
    </>,
  );
  const adjustment = within(await screen.findByRole('region', { name: 'Adjustments' }));
  const issue = within(screen.getByRole('region', { name: 'Issue' }));
  expect(issue.getByRole('columnheader', { name: 'stock-events.stock-on-hand' }).innerHTML).toBe(
    adjustment.getByRole('columnheader', { name: 'stock-events.stock-on-hand' }).innerHTML,
  );
  expect(
    issue
      .getByRole('columnheader', { name: 'stock-events.destination-comments' })
      .querySelector('span'),
  ).toHaveClass('text-xs', 'uppercase', 'tracking-label');
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

it.each(['DOSES', 'PACKS'] as const)('reserves readable Issue controls in %s', async (unit) => {
  const reasons = [
    {
      id: 'transfer',
      name: 'Transfer Out',
      reasonType: 'DEBIT',
      reasonCategory: 'TRANSFER',
      isFreeTextAllowed: true,
      tags: [],
    },
  ];
  const destinations = [
    {
      id: 'chw',
      name: 'CHW',
      isFreeTextAllowed: true,
      programId: 'program',
      facilityTypeId: 'type',
      node: { id: 'node', referenceId: 'chw', refDataFacility: false },
      geoLevelAffinityId: null,
    },
  ];
  const line = newEventLine(
    {
      stockOnHand: 67,
      orderable: { id: 'product', productCode: 'C1', fullProductName: 'Product', netContent: 16 },
      lot: null,
    },
    undefined,
    '2026-10-09',
    { kind: 'issue' },
  );
  line.destination = 'chw';
  line.reasonId = 'transfer';
  function Fixture() {
    const form = useEventForm({
      kind: 'issue',
      reasons,
      destinations,
      today: '2026-10-09',
      onValid: vi.fn(),
      onInvalid: vi.fn(),
    });
    useEffect(() => {
      form.setFieldValue('lines', [line]);
    }, [form]);
    const lines = useStore(form.store, (state) => state.values.lines);
    return (
      <EventLineTable
        kind="issue"
        reasonRequired={false}
        form={form}
        lines={lines}
        reasons={reasons}
        destinations={destinations}
        unit={unit}
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
  await waitFor(() => expect(document.getElementById('lines[0].destination')).toBeInTheDocument());
  for (const [id, width] of [
    ['destination', 'w-54'],
    ['destinationComments', 'w-37'],
    ['reasonId', 'w-38'],
    ['reasonFreeText', 'w-37'],
    ['occurredDate', 'w-31'],
    ['quantity', unit === 'PACKS' ? 'w-27' : 'w-20'],
  ]) {
    expect(document.getElementById(`lines[0].${id}`)?.closest(`.${width}`)).not.toBeNull();
  }
});
