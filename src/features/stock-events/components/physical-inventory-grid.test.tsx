import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhysicalInventoryGrid } from '@/features/stock-events/components/physical-inventory-grid';
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
describe('read-only inventory grid', () => {
  it('uses the legacy product-without-lots label for a no-lot-only group', () => {
    render(
      <PhysicalInventoryGrid
        bands={inventoryPage(lines.slice(0, 1), 'program').bands}
        visibility={{}}
        showVvm={false}
      />,
    );
    expect(screen.getByText('stock-events.product-has-no-lots')).toBeInTheDocument();
  });
  it('shows a category band, product totals and individual lot rows', () => {
    render(
      <PhysicalInventoryGrid
        bands={inventoryPage(lines, 'program').bands}
        visibility={{}}
        showVvm={false}
      />,
    );
    expect(screen.getByText('Medicines')).toBeInTheDocument();
    const summary = screen.getByText('Product').closest('tr') as HTMLElement;
    expect(within(summary).getAllByText('12')).toHaveLength(2);
    expect(screen.getByText('Batch')).toBeInTheDocument();
    expect(screen.getByText('stock-events.no-lot-defined')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('hides optional columns and shows VVM when eligibility requires it', () => {
    render(
      <PhysicalInventoryGrid
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
