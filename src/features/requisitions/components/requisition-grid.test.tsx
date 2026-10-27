import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  type GridSearch,
  RequisitionGridView,
} from '@/features/requisitions/components/requisition-grid';
import { calculateLine, calculateTotals } from '@/features/requisitions/lib/calculations';
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
}: {
  initial?: GridSearch;
  stockBased?: boolean;
  value?: RequisitionRecord;
  tab?: 'fullSupply' | 'nonFullSupply';
  supplyingStock?: boolean;
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
  const models = buildLines(current, hydrated, []).map((model) => ({
    ...model,
    line: calculateLine(model, current, 1),
  }));
  return (
    <RequisitionGridView
      record={current}
      models={models}
      totals={calculateTotals(models)}
      currency={currency}
      tab={tab}
      search={search}
      onSearchChange={update}
      onAdjustments={(id) => update({ adjustments: id })}
      onCloseAdjustments={() => update({ adjustments: undefined })}
      unit="DOSES"
      setUnit={() => {}}
      canSwitch={false}
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
it('shows skipped full-supply products through Filters and clears both filters from no matches', async () => {
  const user = userEvent.setup();
  render(<Harness value={withSkipped} />);
  expect(screen.queryByText(/^Medicine 0/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
  await user.click(
    await screen.findByRole('switch', { name: /requisitions.requisition.show-skipped/ }),
  );
  await user.keyboard('{Escape}');
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
  expect(screen.queryByRole('button', { name: /^Filters/ })).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /^Filters/ })).toBeInTheDocument();
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

it('pins product columns using the measured inline widths for header, body and totals', () => {
  const columns = ['orderable.productCode', 'orderable.fullProductName', 'requestedQuantity'];
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
  const code = screen.getByRole('columnheader', { name: 'orderable.productCode' });
  const name = screen.getByRole('columnheader', { name: 'orderable.fullProductName' });
  expect(code.style.insetInlineStart).toBe('0');
  expect(name.style.insetInlineStart).toBe('1000px');
  expect(screen.getByText('P0').closest('td')?.style.insetInlineStart).toBe('0');
  expect(
    screen.getByText('Medicine 0', { exact: true }).closest('td')?.style.insetInlineStart,
  ).toBe('1000px');
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
