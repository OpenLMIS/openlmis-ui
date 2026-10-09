import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { resolveColumnVisibility } from '@/components/data-table/responsive-columns';
import {
  INVENTORY_HIDEABLE_COLUMNS,
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

  it.each([
    [1600, []],
    [1599, ['productCode']],
    [1479, ['productCode', 'packSize']],
    [1359, ['productCode', 'packSize', 'expiry']],
    [1199, ['productCode', 'packSize', 'expiry', 'stock']],
    [390, ['productCode', 'packSize', 'expiry', 'stock']],
  ])('hides optional columns in priority order at %i pixels', (width, hidden) => {
    const visibility = resolveColumnVisibility(INVENTORY_HIDEABLE_COLUMNS, {}, width);
    expect(
      Object.entries(visibility)
        .filter(([, visible]) => !visible)
        .map(([id]) => id),
    ).toEqual(hidden);
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
