import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { resolveColumnVisibility } from '@/components/data-table/responsive-columns';
import { productName } from '@/features/reference-data/lib/product-name';
import {
  INVENTORY_COLUMN_MIN_WIDTHS,
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

vi.mock('@/features/reference-data/lib/product-name', async (original) => {
  const actual = await original<typeof import('@/features/reference-data/lib/product-name')>();
  return { ...actual, productName: vi.fn(actual.productName) };
});

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

  it('hides optional columns in priority order at the static minimum-width boundaries', () => {
    const columns = inventoryHideableColumns({ showVvm: true, showActions: true });
    const total = Object.values(INVENTORY_COLUMN_MIN_WIDTHS).reduce(
      (sum, { rem }) => sum + rem * 16,
      0,
    );
    let remaining = total;
    for (let removed = 0; removed < columns.length; removed++) {
      expect(columns[removed].hideBelow).toBe(remaining + 2);
      expect(resolveColumnVisibility(columns, {}, remaining + 2)[columns[removed].id]).toBe(true);
      const hidden = Object.entries(resolveColumnVisibility(columns, {}, remaining + 1))
        .filter(([, visible]) => !visible)
        .map(([id]) => id);
      expect(hidden).toEqual(columns.slice(0, removed + 1).map(({ id }) => id));
      remaining -= INVENTORY_COLUMN_MIN_WIDTHS[columns[removed].id].rem * 16;
    }
  });

  it('budgets VVM and Actions only when shown and reserves room for pack inputs', () => {
    const base = inventoryHideableColumns({ showVvm: false, showActions: false });
    const full = inventoryHideableColumns({ showVvm: true, showActions: true });
    expect(full[0].hideBelow - base[0].hideBelow).toBe(
      (INVENTORY_COLUMN_MIN_WIDTHS.vvm.rem + INVENTORY_COLUMN_MIN_WIDTHS.actions.rem) * 16,
    );
    const packs = inventoryHideableColumns({ showVvm: false, showActions: false, unit: 'PACKS' });
    expect(packs[0].hideBelow - base[0].hideBelow).toBe(4 * 16);
  });

  it('counts forced-visible columns, excludes forced-hidden columns and ignores stale choices', () => {
    const options = { showVvm: false, showActions: false };
    const base = inventoryHideableColumns(options);
    expect(inventoryHideableColumns(options, { product: false, lot: false })).toEqual(base);
    const forcedHidden = inventoryHideableColumns(options, { productCode: false });
    expect(forcedHidden[1].hideBelow).toBe(base[1].hideBelow);
    const forcedVisible = inventoryHideableColumns(options, { productCode: true });
    expect(forcedVisible[1].hideBelow).toBe(base[0].hideBelow);
    expect(resolveColumnVisibility(forcedVisible, { productCode: true }, 390)).toEqual({
      productCode: true,
      packSize: false,
      expiry: false,
      stock: false,
    });
    expect(Object.values(resolveColumnVisibility(base, {}, 390))).toEqual([
      false,
      false,
      false,
      false,
    ]);
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

it('describes an unaccounted error immediately after a count changes and clears it with a blank', async () => {
  const user = userEvent.setup();
  render(
    <Grid
      bands={inventoryPage(lines.slice(0, 1), 'program').bands}
      visibility={{}}
      showVvm={false}
    />,
  );
  const input = screen.getByRole('textbox');
  await user.clear(input);
  expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await user.type(input, '4');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')).toHaveTextContent(
    'physical-inventory.unaccounted-error',
  );
  await user.clear(input);
  expect(input).not.toHaveAttribute('aria-invalid', 'true');
});

it('updates product totals through the group subscription with stable bands', async () => {
  const user = userEvent.setup();
  render(<Grid bands={inventoryPage(lines, 'program').bands} visibility={{}} showVvm={false} />);
  const input = screen.getAllByRole('textbox')[0];
  await user.clear(input);
  await user.type(input, '6');
  const summary = screen.getByText('Product').closest('tr') as HTMLElement;
  expect(within(summary).getByText('13')).toBeInTheDocument();
});

it('leaves another product summary subscribed only to its own rows during count entry', async () => {
  const user = userEvent.setup();
  const other = { ...orderable, id: 'other', productCode: 'Q', fullProductName: 'Other' };
  const others = lines.map((line) => ({ ...line, key: `other-${line.key}`, orderable: other }));
  render(
    <Grid
      bands={inventoryPage([...lines, ...others], 'program').bands}
      visibility={{}}
      showVvm={false}
    />,
  );
  vi.mocked(productName).mockClear();
  const input = screen.getAllByRole('textbox')[0];
  await user.clear(input);
  await user.type(input, '6');
  expect(vi.mocked(productName).mock.calls.some(([product]) => product.productCode === 'Q')).toBe(
    false,
  );
});
