import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { InventoryAddProductsDialog } from '@/features/stock-events/components/inventory-add-products-dialog';
import { buildInventoryLines } from '@/features/stock-events/lib/physical-inventory-lines';

const product = {
  id: 'p',
  productCode: 'P',
  fullProductName: 'Product',
  description: null,
  identifiers: { tradeItem: 't' },
};
const eligible = [
  {
    orderable: product,
    lot: { id: 'l', lotCode: 'Batch', expirationDate: '2000-01-01' },
    stockOnHand: 0,
    stockCardId: 'c',
    active: true,
  },
  { orderable: product, lot: null, stockOnHand: null },
];
const choose = async (user: ReturnType<typeof userEvent.setup>, name: string, option: string) => {
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(screen.getByRole('option', { name: option }));
};
it('shows pending products', () => {
  render(
    <InventoryAddProductsDialog
      eligible={undefined}
      listed={[]}
      canManageLots={false}
      unit="DOSES"
      onClose={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  expect(screen.getByText('physical-inventory.products-loading')).toBeInTheDocument();
});
it('excludes listed lots, respects the new-lot right, and adds zero counts', async () => {
  const user = userEvent.setup();
  const add = vi.fn();
  render(
    <InventoryAddProductsDialog
      eligible={eligible}
      listed={buildInventoryLines([eligible[0]], [])}
      canManageLots={false}
      unit="DOSES"
      onClose={vi.fn()}
      onAdd={add}
    />,
  );
  await choose(user, 'stock-events.product', 'Product');
  await user.click(screen.getByRole('combobox', { name: 'stock-events.lot-code' }));
  expect(screen.queryByRole('option', { name: 'Batch' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('option', { name: 'physical-inventory.add-new-lot' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'stock-events.no-lot-defined' }));
  await user.click(screen.getByRole('button', { name: 'stock-events.add' }));
  await user.type(screen.getByRole('textbox', { name: 'stock-events.field-of' }), '0');
  await user.click(screen.getByRole('button', { name: 'physical-inventory.add-items' }));
  expect(add).toHaveBeenCalledWith([
    expect.objectContaining({ quantity: expect.objectContaining({ doses: '0' }), justAdded: true }),
  ]);
});
it('offers new lot first and refuses a duplicate before adding', async () => {
  const user = userEvent.setup();
  render(
    <InventoryAddProductsDialog
      eligible={eligible}
      listed={[]}
      canManageLots
      unit="DOSES"
      onClose={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  await choose(user, 'stock-events.product', 'Product');
  await user.click(screen.getByRole('combobox', { name: 'stock-events.lot-code' }));
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('physical-inventory.add-new-lot');
  await user.click(screen.getByRole('option', { name: 'physical-inventory.add-new-lot' }));
  await user.type(
    screen.getByRole('textbox', { name: 'physical-inventory.new-lot-code' }),
    'bAtCh',
  );
  await user.click(screen.getByRole('button', { name: 'stock-events.add' }));
  expect(screen.getByRole('textbox', { name: 'physical-inventory.new-lot-code' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(within(screen.getByRole('table')).queryByText('bAtCh')).not.toBeInTheDocument();
});

it('adds a new lot with Enter without submitting the outer dialog', async () => {
  const user = userEvent.setup();
  const add = vi.fn();
  render(
    <InventoryAddProductsDialog
      eligible={eligible}
      listed={[]}
      canManageLots
      unit="DOSES"
      onClose={vi.fn()}
      onAdd={add}
    />,
  );
  await choose(user, 'stock-events.product', 'Product');
  await choose(user, 'stock-events.lot-code', 'physical-inventory.add-new-lot');
  await user.type(
    screen.getByRole('textbox', { name: 'physical-inventory.new-lot-code' }),
    'New Batch{Enter}',
  );
  expect(await within(screen.getByRole('table')).findByText('New Batch')).toBeInTheDocument();
  expect(add).not.toHaveBeenCalled();
});

it('accepts only digits for the added product Current Stock', async () => {
  const user = userEvent.setup();
  render(
    <InventoryAddProductsDialog
      eligible={eligible}
      listed={[]}
      canManageLots={false}
      unit="DOSES"
      onClose={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  await choose(user, 'stock-events.product', 'Product');
  await choose(user, 'stock-events.lot-code', 'stock-events.no-lot-defined');
  await user.click(screen.getByRole('button', { name: 'stock-events.add' }));
  const input = screen.getByRole('textbox', { name: 'stock-events.field-of' });
  await user.type(input, '-1.٢x۳');
  expect(input).toHaveValue('123');
});
