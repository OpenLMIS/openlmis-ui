import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { resolveColumnVisibility } from '@/components/data-table/responsive-columns';
import {
  INVENTORY_HIDEABLE_COLUMNS,
  inventoryHideableColumns,
  PhysicalInventoryGrid,
  PhysicalInventoryGridSkeleton,
} from '@/features/stock-events/components/physical-inventory-grid';
import { usePhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import {
  buildInventoryLines,
  inventoryPage,
} from '@/features/stock-events/lib/physical-inventory-lines';

const orderable = {
  id: 'p',
  productCode: 'P',
  fullProductName: 'Product',
  description: null,
  netContent: 10,
  programs: [{ programId: 'program', orderableCategoryDisplayName: 'Medicines' }],
};
const lines = buildInventoryLines(
  [
    { orderable, lot: null, stockOnHand: 5, stockCardId: 'c', active: true },
    {
      orderable,
      lot: { id: 'lot', lotCode: 'Batch', expirationDate: null },
      stockOnHand: 7,
      stockCardId: 'c2',
      active: true,
    },
  ],
  [
    { orderableId: 'p', quantity: 5 },
    { orderableId: 'p', lotId: 'lot', quantity: 7 },
  ],
);
describe('inventory grid', () => {
  it('uses No Lot Defined for a no-lot-only group', () => {
    render(
      <Grid
        bands={inventoryPage(lines.slice(0, 1), 'program').bands}
        visibility={{}}
        showVvm={false}
      />,
    );
    expect(screen.getByText('stock-events.no-lot-defined')).toBeInTheDocument();
  });
  it('shows a category band, product totals and individual lot rows', () => {
    render(<Grid bands={inventoryPage(lines, 'program').bands} visibility={{}} showVvm={false} />);
    expect(screen.getByText('Medicines')).toBeInTheDocument();
    const summary = screen.getByText('Product').closest('tr') as HTMLElement;
    expect(within(summary).getAllByText('12')).toHaveLength(2);
    expect(screen.getByText('Batch')).toBeInTheDocument();
    expect(screen.getByText('stock-events.no-lot-defined')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });
  it('hides optional columns and shows VVM when eligibility requires it', () => {
    render(
      <Grid
        bands={inventoryPage(lines, 'program').bands}
        visibility={{ productCode: false, packSize: false, expiry: false }}
        showVvm
      />,
    );
    expect(
      screen.queryByRole('columnheader', { name: 'stock-events.product-code' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'stock-events.vvm-status' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'physical-inventory.current-stock' }),
    ).toBeInTheDocument();
  });
});

function Grid(
  props: Omit<ComponentProps<typeof PhysicalInventoryGrid>, 'editor' | 'showActions'> & {
    unit?: 'DOSES' | 'PACKS';
    online?: boolean;
    showActions?: boolean;
  },
) {
  const form = usePhysicalInventoryForm(
    props.bands.flatMap((band) => band.groups.flatMap((group) => group.lines)),
  );
  return (
    <PhysicalInventoryGrid
      {...props}
      showActions={props.showActions ?? false}
      editor={{
        form,
        unit: props.unit ?? 'DOSES',
        online: props.online ?? true,
        pending: false,
        validationAttempted: false,
        onReasons: vi.fn(),
        onEditLot: vi.fn(),
        onRemove: vi.fn(),
        onDeactivate: vi.fn(),
      }}
    />
  );
}
it('uses packs for both summary totals and shows pack size on each lot', () => {
  render(
    <Grid
      bands={inventoryPage(lines, 'program').bands}
      visibility={{}}
      showVvm={false}
      unit="PACKS"
    />,
  );
  const summary = screen.getByText('Product').closest('tr') as HTMLElement;
  expect(within(summary).getAllByText('1 ( +2 )')).toHaveLength(2);
  expect(screen.getAllByText('10')).toHaveLength(3);
});

it('shows Deactivate offline but keeps it disabled', async () => {
  const user = userEvent.setup();
  const zero = { ...lines[0], stockOnHand: 0, active: true };
  render(
    <Grid
      bands={inventoryPage([zero], 'program').bands}
      visibility={{}}
      showVvm={false}
      showActions
      online={false}
    />,
  );
  await user.click(
    screen
      .getAllByRole('button', { name: 'stock-events.field-of' })
      .find((button) => button.querySelector('svg')) as HTMLElement,
  );
  expect(screen.getByRole('menuitem', { name: 'physical-inventory.deactivate' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

describe('inventory column priorities', () => {
  it('offers only the four lower-priority columns in View', () => {
    expect(INVENTORY_HIDEABLE_COLUMNS.map(({ id }) => id)).toEqual([
      'productCode',
      'packSize',
      'expiry',
      'stock',
    ]);
  });

  it('fits every column when their summed readable widths fit', () => {
    const widths = {
      productCode: 96,
      product: 144,
      packSize: 64,
      lot: 112,
      expiry: 88,
      stock: 96,
      count: 88,
      vvm: 88,
      reasons: 112,
      unaccounted: 136,
      actions: 64,
    };
    const columns = inventoryHideableColumns(widths);
    const total = Object.values(widths).reduce((sum, width) => sum + width, 0);
    expect(columns.map(({ hideBelow }) => hideBelow)).toEqual([
      total,
      total - widths.productCode,
      total - widths.productCode - widths.packSize,
      total - widths.productCode - widths.packSize - widths.expiry,
    ]);
    for (let removed = 0; removed < columns.length; removed++) {
      const width = columns[removed].hideBelow;
      expect(resolveColumnVisibility(columns, {}, width)[columns[removed].id]).toBe(true);
      const hidden = Object.entries(resolveColumnVisibility(columns, {}, width - 1))
        .filter(([, visible]) => !visible)
        .map(([id]) => id);
      expect(hidden).toEqual(columns.slice(0, removed + 1).map(({ id }) => id));
    }
    expect(Object.values(resolveColumnVisibility(columns, {}, 1100))).not.toContain(false);
  });

  it('budgets only applicable columns and preserves explicit View choices', () => {
    const widths = {
      productCode: 100,
      product: 160,
      packSize: 80,
      lot: 112,
      expiry: 96,
      stock: 104,
      count: 104,
      reasons: 112,
      unaccounted: 144,
    };
    const columns = inventoryHideableColumns(widths);
    expect(columns[0].hideBelow).toBe(1012);
    expect(resolveColumnVisibility(columns, { productCode: true }, 390)).toEqual({
      productCode: true,
      packSize: false,
      expiry: false,
      stock: false,
    });
  });

  it('counts forced-visible columns and excludes forced-hidden columns from the budget', () => {
    const widths = {
      productCode: 100,
      product: 160,
      packSize: 80,
      lot: 112,
      expiry: 96,
      stock: 104,
      count: 104,
      reasons: 112,
      unaccounted: 144,
    };
    expect(inventoryHideableColumns(widths, { product: false, lot: false })[0].hideBelow).toBe(
      1012,
    );
    const forcedHidden = inventoryHideableColumns(widths, { productCode: false });
    expect(forcedHidden[1].hideBelow).toBe(912);
    const forcedVisible = inventoryHideableColumns(widths, { productCode: true });
    expect(forcedVisible[1].hideBelow).toBe(1012);
    expect(resolveColumnVisibility(forcedVisible, { productCode: true }, 950).packSize).toBe(false);
  });

  it('keeps identifying and editing columns despite stale stored choices', () => {
    const visibility = {
      product: false,
      lot: false,
      count: false,
      reasons: false,
      unaccounted: false,
    };
    const props = { visibility, showVvm: false };
    const { unmount } = render(<Grid {...props} bands={inventoryPage(lines, 'program').bands} />);
    expect(screen.getByText('Batch')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    const headers = screen.getAllByRole('columnheader').map((head) => head.textContent);
    unmount();
    render(<PhysicalInventoryGridSkeleton {...props} />);
    expect(screen.getAllByRole('columnheader').map((head) => head.textContent)).toEqual(headers);
  });
});
