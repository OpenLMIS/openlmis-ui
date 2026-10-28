import { useStore } from '@tanstack/react-form';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  type GridSearch,
  RequisitionGridView,
} from '@/features/requisitions/components/requisition-grid';
import { useRequisitionForm } from '@/features/requisitions/hooks/use-requisition-form';
import { calculateLine, calculateTotals } from '@/features/requisitions/lib/calculations';
import { applyRequisitionDraft } from '@/features/requisitions/lib/draft';
import { column, line, product, record } from '@/features/requisitions/lib/fixtures/builders';
import { buildLines } from '@/features/requisitions/lib/lines';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import type { SearchChange } from '@/lib/table-search';

const products = Array.from({ length: 12 }, (_, index) =>
  product({
    id: `p${index}`,
    productCode: `P${index}`,
    fullProductName: `Medicine ${index}`,
    dispensable: { displayUnit: 'Tablet' },
    programs: [
      {
        programId: 'program',
        fullSupply: true,
        pricePerPack: 2,
        orderableCategoryDisplayName: 'Category A',
      },
    ],
  }),
);
const requisition: RequisitionRecord = {
  ...record({
    template: {
      columnsMap: Object.fromEntries(
        ['orderable.fullProductName', 'totalLossesAndAdjustments', 'totalCost'].map((name, i) => [
          name,
          column(name, i),
        ]),
      ),
    },
    stockAdjustmentReasons: [
      { reasonId: 'hidden', name: 'Historical Reason', reasonType: 'CREDIT', hidden: true },
    ],
  }),
  id: 'record',
  facility: { id: 'facility' },
  processingPeriod: { id: 'period' },
  requisitionLineItems: products.map((p, i) => ({
    ...line({
      id: `l${i}`,
      requestedQuantity: 10,
      stockAdjustments: [{ reasonId: 'hidden', quantity: 3 }],
    }),
    orderable: { id: p.id, versionNumber: 1 },
    approvedProduct: { id: 'approved', versionNumber: 1 },
  })),
};
const currency = {
  currencyCode: 'USD',
  currencySymbol: '$',
  currencySymbolSide: 'left' as const,
  currencyDecimalPlaces: 2,
  groupingSize: 3,
  groupingSeparator: ',',
  decimalSeparator: '.',
};
function Harness({
  initial = {},
  stockBased = false,
  value = requisition,
  tab = 'fullSupply',
  supplyingStock = false,
  editable = false,
}: {
  initial?: GridSearch;
  stockBased?: boolean;
  value?: RequisitionRecord;
  tab?: 'fullSupply' | 'nonFullSupply';
  supplyingStock?: boolean;
  editable?: boolean;
}) {
  const [search, setSearch] = useState<GridSearch>(initial);
  const update: SearchChange<GridSearch> = (change) =>
    setSearch((previous) => ({
      ...previous,
      ...(typeof change === 'function' ? change(previous) : change),
    }));
  const current = stockBased
    ? { ...value, template: { ...value.template, populateStockOnHandFromStockCards: true } }
    : value;
  const hydrated =
    tab === 'nonFullSupply'
      ? products.map((p) => ({
          ...p,
          programs: p.programs?.map((entry) => ({ ...entry, fullSupply: false })),
        }))
      : products;
  const editor = useRequisitionForm(current);
  const draft = useStore(editor.form.store, (state) => state.values.draft);
  const [unit, setUnit] = useState<'DOSES' | 'PACKS'>('DOSES');
  const draftRecord = editable ? applyRequisitionDraft(current, draft) : current;
  const models = buildLines(draftRecord, hydrated, []).map((model) => ({
    ...model,
    line: calculateLine(model, current, 1),
  }));
  return (
    <RequisitionGridView
      record={draftRecord}
      editing={
        editable
          ? {
              editor,
              editable: true,
              editableColumns: ['requestedQuantity'],
              skipLines: true,
              addFullSupplyProduct: false,
              addNonFullSupplyProduct: true,
            }
          : undefined
      }
      models={models}
      totals={calculateTotals(models)}
      currency={currency}
      tab={tab}
      search={search}
      onSearchChange={update}
      onAdjustments={(id) => update({ adjustments: id })}
      onCloseAdjustments={() => update({ adjustments: undefined })}
      unit={unit}
      setUnit={setUnit}
      canSwitch={editable}
      supplyingStock={supplyingStock}
    />
  );
}
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each([1000, 390])(
  'keeps category headings on later pages and totals across all products at width %s',
  async (width) => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('Category A')).toBeInTheDocument();
    if (width >= 672) expect(screen.getAllByText('$24.00')).toHaveLength(1);
    if (width >= 672)
      expect(within(screen.getByRole('table')).getByText('$24.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next Page' }));
    expect(screen.getByText('Category A')).toBeInTheDocument();
    expect(screen.getByText(/Medicine 8/)).toBeInTheDocument();
    expect(screen.queryByText(/^Medicine 0/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Page' })).toBeDisabled();
    if (width >= 672) expect(screen.getAllByText('$24.00')).toHaveLength(1);
    if (width >= 672)
      expect(within(screen.getByRole('table')).getByText('$24.00')).toBeInTheDocument();
  },
);
it('opens adjustments from the URL state using hidden snapshot reasons and read-only quantities', async () => {
  render(<Harness initial={{ adjustments: 'l0' }} />);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Historical Reason')).toBeInTheDocument();
  expect(within(dialog).getAllByText('3').length).toBeGreaterThan(0);
});

it('keeps stock-based adjustments as plain values even with a directly linked dialog', () => {
  render(<Harness initial={{ adjustments: 'l0' }} stockBased />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /^totalLossesAndAdjustments:/ }),
  ).not.toBeInTheDocument();
});

const withSkipped: RequisitionRecord = {
  ...requisition,
  template: {
    columnsMap: {
      ...requisition.template.columnsMap,
      skipped: column('skipped', 4, { option: { optionName: 'hideSkippedLineItems' } }),
    },
  },
  requisitionLineItems: requisition.requisitionLineItems.map((item) => ({
    ...item,
    skipped: true,
  })),
};
it('shows skipped full-supply products from the toolbar checkbox and clears both filters from no matches', async () => {
  const user = userEvent.setup();
  render(<Harness value={withSkipped} />);
  expect(screen.queryByText(/^Medicine 0/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: 'requisitions.requisition.show-skipped' }));
  expect(screen.getByText(/^Medicine 0/)).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'skipped: Medicine 0' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await user.type(screen.getByRole('textbox'), 'absent');
  await user.click(await screen.findByRole('button', { name: 'data-table.clear-filters' }));
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(screen.queryByText(/^Medicine 0/)).not.toBeInTheDocument();
});
it('does not hide skipped non-full-supply products', () => {
  render(<Harness value={withSkipped} tab="nonFullSupply" />);
  expect(screen.getByText(/^Medicine 0/)).toBeInTheDocument();
  expect(
    screen.queryByRole('checkbox', { name: 'requisitions.requisition.show-skipped' }),
  ).not.toBeInTheDocument();
});
it.each([false, true])(
  'hides skipped full-supply products even with a hidden skip column, emergency=%s',
  (emergency) => {
    render(
      <Harness
        value={{
          ...withSkipped,
          emergency,
          template: {
            columnsMap: {
              ...withSkipped.template.columnsMap,
              skipped: column('skipped', 4, {
                isDisplayed: false,
                option: { optionName: 'hideSkippedLineItems' },
              }),
            },
          },
        }}
      />,
    );
    expect(screen.queryByText(/^Medicine 0/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'requisitions.requisition.show-skipped' }),
    ).toBeInTheDocument();
  },
);
it('shows the exact product name in the table without its display unit', () => {
  render(<Harness />);
  expect(screen.getByText('Medicine 0', { exact: true })).toBeInTheDocument();
});
it('shows only the access banner when supplying stock access is denied', () => {
  render(
    <Harness
      supplyingStock
      value={{
        ...requisition,
        supplyingFacilityAccessDenied: true,
        supplyingFacilities: [{ id: 'supplier', name: 'Supplier Name' }],
        template: {
          columnsMap: {
            ...requisition.template.columnsMap,
            supplyingFacilityStockOnHand: column('supplyingFacilityStockOnHand', 5),
          },
        },
      }}
    />,
  );
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText(/Supplier Name/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('columnheader', { name: 'supplyingFacilityStockOnHand' }),
  ).not.toBeInTheDocument();
});

it('pins skip, code and product at cumulative measured widths in header and body', () => {
  vi.spyOn(HTMLTableCellElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 120.5,
  } as DOMRect);
  const columns = [
    'skipped',
    'orderable.productCode',
    'orderable.fullProductName',
    'requestedQuantity',
  ];
  render(
    <Harness
      value={{
        ...requisition,
        template: {
          columnsMap: Object.fromEntries(columns.map((name, i) => [name, column(name, i)])),
        },
      }}
    />,
  );
  const offsets = columns.map(
    (name) => screen.getByRole('columnheader', { name }).style.insetInlineStart,
  );
  expect(offsets).toEqual(['0', '120px', '241px', '']);
  expect(screen.getByText('P0').closest('td')?.style.insetInlineStart).toBe('120px');
  expect(
    screen.getByText('Medicine 0', { exact: true }).closest('td')?.style.insetInlineStart,
  ).toBe('241px');
});

it('opens adjustments through a name that includes the visible quantity and product', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    screen.getByRole('button', { name: 'totalLossesAndAdjustments: 3, Medicine 0' }),
  );
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
it.each([1000, 390])('labels shortfall beyond colour at width %s', (width) => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
  render(
    <Harness
      supplyingStock
      value={{
        ...requisition,
        status: 'IN_APPROVAL',
        supplyingFacilities: [{ id: 'supplier' }],
        template: {
          columnsMap: {
            ...requisition.template.columnsMap,
            supplyingFacilityStockOnHand: column('supplyingFacilityStockOnHand', 5),
          },
        },
        requisitionLineItems: requisition.requisitionLineItems.map((l) => ({
          ...l,
          approvedQuantity: 5,
          supplyingFacilityStockOnHand: 2,
        })),
      }}
    />,
  );
  expect(screen.getAllByText('requisitions.requisition.stock-shortfall')).toHaveLength(10);
});

it('omits the summary row when the template has no cost column', () => {
  const { totalCost: _cost, ...columnsMap } = requisition.template.columnsMap;
  render(<Harness value={{ ...requisition, template: { columnsMap } }} />);
  expect(screen.queryByText('requisitions.requisition.total')).not.toBeInTheDocument();
});

it.each([1000, 390])(
  'keeps editable quantities across unit switches and paging at width %s',
  async (width) => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
    const user = userEvent.setup();
    render(
      <Harness
        editable
        value={{
          ...requisition,
          template: {
            columnsMap: {
              ...requisition.template.columnsMap,
              requestedQuantity: column('requestedQuantity', 3, {
                source: 'USER_INPUT',
                columnDefinition: { columnType: 'NUMERIC' },
              }),
            },
          },
        }}
      />,
    );
    const label = 'requestedQuantity: Medicine 0 (P0)';
    const input = screen.getByRole('textbox', { name: label });
    await user.clear(input);
    await user.type(input, '27');
    await user.click(screen.getByRole('radio', { name: 'quantity-unit.packs' }));
    expect(screen.getByRole('textbox', { name: `${label} quantity-unit.packs` })).toHaveValue('2');
    expect(screen.getByRole('textbox', { name: `${label} quantity-unit.doses` })).toHaveValue('7');
    await user.click(screen.getByRole('button', { name: 'Next Page' }));
    await user.click(screen.getByRole('button', { name: 'Previous Page' }));
    await user.click(screen.getByRole('radio', { name: 'quantity-unit.doses' }));
    expect(screen.getByRole('textbox', { name: label })).toHaveValue('27');
  },
);

it('skips only empty lines and unskips populated lines with None or their checkbox', async () => {
  const user = userEvent.setup();
  render(
    <Harness
      editable
      value={{
        ...requisition,
        template: {
          columnsMap: {
            'orderable.fullProductName': column('orderable.fullProductName', 0),
            requestedQuantity: column('requestedQuantity', 1, {
              source: 'USER_INPUT',
              columnDefinition: { columnType: 'NUMERIC' },
            }),
            skipped: column('skipped', 2, { source: 'USER_INPUT' }),
          },
        },
        requisitionLineItems: requisition.requisitionLineItems.slice(0, 4).map((item, i) => ({
          ...item,
          requestedQuantity: i === 0 ? null : 10,
          skipped: i >= 2,
        })),
      }}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'requisitions.edit.skip-all' }));
  expect(screen.getByRole('checkbox', { name: 'skipped: Medicine 0 (P0)' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'skipped: Medicine 1 (P1)' })).not.toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'skipped: Medicine 2 (P2)' }));
  expect(screen.getByRole('checkbox', { name: 'skipped: Medicine 2 (P2)' })).not.toBeChecked();
  await user.click(screen.getByRole('button', { name: 'requisitions.edit.skip-none' }));
  expect(screen.getByRole('checkbox', { name: 'skipped: Medicine 3 (P3)' })).not.toBeChecked();
});
it.each([1000, 390])('removes saved non-full supply lines instantly at width %s', async (width) => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
  const user = userEvent.setup();
  render(<Harness editable tab="nonFullSupply" />);
  await user.click(
    screen.getByRole('button', { name: 'requisitions.edit.remove-product: Medicine 0' }),
  );
  expect(screen.queryByText(/^Medicine 0/)).not.toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

it('limits This Page to the current page while All includes later pages', async () => {
  const user = userEvent.setup();
  render(
    <Harness
      editable
      initial={{ detailSize: 1 }}
      value={{
        ...requisition,
        template: {
          columnsMap: {
            'orderable.fullProductName': column('orderable.fullProductName', 0),
            skipped: column('skipped', 1, { source: 'USER_INPUT' }),
          },
        },
      }}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'requisitions.edit.skip-page' }));
  expect(screen.getByRole('checkbox', { name: 'skipped: Medicine 0 (P0)' })).toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Next Page' }));
  expect(screen.getByRole('checkbox', { name: 'skipped: Medicine 1 (P1)' })).not.toBeChecked();
  await user.click(screen.getByRole('button', { name: 'requisitions.edit.skip-all' }));
  expect(screen.getByRole('checkbox', { name: 'skipped: Medicine 1 (P1)' })).toBeChecked();
});
