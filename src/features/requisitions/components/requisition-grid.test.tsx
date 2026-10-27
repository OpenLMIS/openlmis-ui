import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  type GridSearch,
  RequisitionGridView,
} from '@/features/requisitions/components/requisition-grid';
import { column, line, product, record } from '@/features/requisitions/lib/fixtures/builders';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import type { SearchChange } from '@/lib/table-search';

const products = Array.from({ length: 12 }, (_, index) =>
  product({
    id: `p${index}`,
    productCode: `P${index}`,
    fullProductName: `Medicine ${index}`,
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
}: {
  initial?: GridSearch;
  stockBased?: boolean;
}) {
  const [search, setSearch] = useState<GridSearch>(initial);
  const update: SearchChange<GridSearch> = (change) =>
    setSearch((previous) => ({
      ...previous,
      ...(typeof change === 'function' ? change(previous) : change),
    }));
  return (
    <RequisitionGridView
      record={
        stockBased
          ? {
              ...requisition,
              template: { ...requisition.template, populateStockOnHandFromStockCards: true },
            }
          : requisition
      }
      products={products}
      approvedProducts={[]}
      monthsInPeriod={1}
      currency={currency}
      showNonFullSupply
      tab="fullSupply"
      search={search}
      onSearchChange={update}
      onAdjustments={(id) => update({ adjustments: id })}
      onCloseAdjustments={() => update({ adjustments: undefined })}
      unit="DOSES"
      setUnit={() => {}}
      canSwitch={false}
      supplyingStock={false}
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
    expect(screen.getAllByText('$24.00')).toHaveLength(width >= 672 ? 2 : 1);
    if (width >= 672)
      expect(within(screen.getByRole('table')).getByText('$24.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next Page' }));
    expect(screen.getByText('Category A')).toBeInTheDocument();
    expect(screen.getByText(/Medicine 8/)).toBeInTheDocument();
    expect(screen.queryByText(/^Medicine 0/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Page' })).toBeDisabled();
    expect(screen.getAllByText('$24.00')).toHaveLength(width >= 672 ? 2 : 1);
    if (width >= 672)
      expect(within(screen.getByRole('table')).getByText('$24.00')).toBeInTheDocument();
  },
);
it('opens adjustments from the URL state using hidden snapshot reasons and read-only quantities', async () => {
  render(<Harness initial={{ adjustments: 'l0' }} />);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Historical Reason')).toBeInTheDocument();
  expect(within(dialog).queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  expect(within(dialog).getAllByText('3').length).toBeGreaterThan(0);
});

it('keeps stock-based adjustments as plain values even with a directly linked dialog', () => {
  render(<Harness initial={{ adjustments: 'l0' }} stockBased />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /^totalLossesAndAdjustments:/ }),
  ).not.toBeInTheDocument();
});
