import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import { InventoryReasonsDialog } from '@/features/stock-events/components/inventory-reasons-dialog';
import { buildInventoryLines } from '@/features/stock-events/lib/physical-inventory-lines';

const line = {
  ...buildInventoryLines(
    [
      {
        orderable: { id: 'p', productCode: 'P', fullProductName: 'Product', description: null },
        lot: null,
        stockOnHand: 10,
        stockCardId: 'c',
      },
    ],
    [],
  )[0],
  quantity: quantityValue('12'),
};
const reason = {
  id: 'r',
  name: 'Return',
  reasonType: 'CREDIT',
  reasonCategory: 'TRANSFER',
  tags: [],
  isFreeTextAllowed: false,
};
it('adds, edits and removes reasons and confirms an unaccounted update', async () => {
  const user = userEvent.setup();
  const update = vi.fn();
  render(
    <InventoryReasonsDialog
      line={line}
      reasons={[reason]}
      unit="DOSES"
      onClose={vi.fn()}
      onUpdate={update}
    />,
  );
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: 'Return' }));
  await user.type(screen.getByRole('textbox', { name: 'stock-events.quantity' }), '2');
  await user.click(screen.getByRole('button', { name: 'stock-events.add' }));
  const edit = screen.getByRole('textbox', { name: 'Return' });
  await user.clear(edit);
  await user.type(edit, '1');
  await user.click(screen.getByRole('button', { name: 'physical-inventory.update' }));
  expect(update).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'stock-events.confirm' }));
  expect(update).toHaveBeenCalledWith([
    { reason: expect.objectContaining({ id: 'r' }), quantity: 1 },
  ]);
  await user.click(screen.getByText('stock-events.remove'));
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'Return' })).not.toBeInTheDocument(),
  );
});
it('refuses zero reason quantity', async () => {
  const user = userEvent.setup();
  const update = vi.fn();
  render(
    <InventoryReasonsDialog
      line={{ ...line, stockAdjustments: [{ reason, quantity: 0 }] }}
      reasons={[reason]}
      unit="DOSES"
      onClose={vi.fn()}
      onUpdate={update}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'physical-inventory.update' }));
  expect(update).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'Return' })).toHaveAttribute('aria-invalid', 'true');
});

it('adds a reason with Enter without updating the outer dialog', async () => {
  const user = userEvent.setup();
  const update = vi.fn();
  render(
    <InventoryReasonsDialog
      line={line}
      reasons={[reason]}
      unit="DOSES"
      onClose={vi.fn()}
      onUpdate={update}
    />,
  );
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: 'Return' }));
  await user.type(screen.getByRole('textbox', { name: 'stock-events.quantity' }), '2{Enter}');
  expect(await screen.findByRole('textbox', { name: 'Return' })).toHaveValue('2');
  expect(update).not.toHaveBeenCalled();
});
