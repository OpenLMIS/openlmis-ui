import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import { InventoryEditLotDialog } from '@/features/stock-events/components/inventory-edit-lot-dialog';
import { addedInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';

const line = addedInventoryLine(
  {
    orderable: { id: 'p', productCode: 'P', fullProductName: 'Product', description: null },
    lot: null,
    stockOnHand: null,
  },
  quantityValue('0'),
  { clientId: 'client', lotCode: 'New', expirationDate: null, tradeItemId: 't' },
);
it('edits the new lot while retaining its client identity', async () => {
  const user = userEvent.setup();
  const update = vi.fn();
  render(
    <InventoryEditLotDialog line={line} listed={[line]} onClose={vi.fn()} onUpdate={update} />,
  );
  const code = screen.getByRole('textbox', { name: 'stock-events.lot-code' });
  await user.clear(code);
  await user.type(code, 'Changed');
  await user.click(screen.getByRole('button', { name: 'physical-inventory.update' }));
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ clientId: 'client', lotCode: 'Changed' }),
  );
});
it('refuses a code differing only in case from another lot', async () => {
  const user = userEvent.setup();
  const update = vi.fn();
  render(
    <InventoryEditLotDialog
      line={line}
      listed={[
        line,
        {
          ...line,
          key: 'p|existing',
          newLot: { clientId: 'other', expirationDate: null, tradeItemId: 't', lotCode: 'Taken' },
        },
      ]}
      onClose={vi.fn()}
      onUpdate={update}
    />,
  );
  const code = screen.getByRole('textbox', { name: 'stock-events.lot-code' });
  await user.clear(code);
  await user.type(code, 'TAKEN');
  await user.click(screen.getByRole('button', { name: 'physical-inventory.update' }));
  expect(update).not.toHaveBeenCalled();
  expect(code).toHaveAttribute('aria-invalid', 'true');
});
