import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { InventoryAddProductsDialog } from '@/features/stock-events/components/inventory-add-products-dialog';
import { buildInventoryLines } from '@/features/stock-events/lib/physical-inventory-lines';

vi.mock('@/components/data-table/responsive-columns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/data-table/responsive-columns')>()),
  useElementWidth: vi.fn(() => [vi.fn(), 672]),
}));
beforeEach(() => {
  vi.mocked(useElementWidth).mockReturnValue([vi.fn(), 672]);
});

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

it('keeps available products in legacy order instead of sorting by product code', async () => {
  const user = userEvent.setup();
  const second = { ...product, id: 'second', productCode: 'A', fullProductName: 'Second' };
  render(
    <InventoryAddProductsDialog
      eligible={[...eligible, { orderable: second, lot: null, stockOnHand: null }]}
      listed={[]}
      canManageLots={false}
      unit="DOSES"
      onClose={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('combobox', { name: 'stock-events.product' }));
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
    'Product',
    'Second',
  ]);
});

it('labels a no-lot item by the available lots left in its product group', async () => {
  const user = userEvent.setup();
  render(
    <InventoryAddProductsDialog
      eligible={eligible}
      listed={buildInventoryLines([eligible[0]], [])}
      canManageLots={false}
      unit="DOSES"
      onClose={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  await choose(user, 'stock-events.product', 'Product');
  await choose(user, 'stock-events.lot-code', 'stock-events.no-lot-defined');
  await user.click(screen.getByRole('button', { name: 'stock-events.add' }));
  expect(
    await within(screen.getByRole('table')).findByText('stock-events.product-has-no-lots'),
  ).toBeInTheDocument();
});

it('lists products with available items before products whose lots are all listed', async () => {
  const user = userEvent.setup();
  const other = { ...product, id: 'other', productCode: 'Z', fullProductName: 'Other' };
  render(
    <InventoryAddProductsDialog
      eligible={[...eligible, { orderable: other, lot: null, stockOnHand: null }]}
      listed={buildInventoryLines(eligible, [
        { orderableId: product.id, lotId: null, quantity: 0 },
      ])}
      canManageLots={false}
      unit="DOSES"
      onClose={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('combobox', { name: 'stock-events.product' }));
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
    'Other',
    'Product',
  ]);
});

it('keeps No Lot Defined in the items table when the available group has a lot', async () => {
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
  expect(
    await within(screen.getByRole('table')).findByText('stock-events.no-lot-defined'),
  ).toBeInTheDocument();
});

it('leaves an unnamed product blank in the picker and added-items table, as legacy', async () => {
  const user = userEvent.setup();
  render(
    <InventoryAddProductsDialog
      eligible={[
        {
          orderable: { ...product, fullProductName: '', productCode: '0517-0920' },
          lot: null,
          stockOnHand: null,
        },
      ]}
      listed={[]}
      canManageLots={false}
      unit="DOSES"
      onClose={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('combobox', { name: 'stock-events.product' }));
  const option = screen.getByRole('option');
  expect(option).not.toHaveTextContent('0517-0920');
  await user.click(option);
  await choose(user, 'stock-events.lot-code', 'stock-events.no-lot-defined');
  await user.click(screen.getByRole('button', { name: 'stock-events.add' }));
  const cells = within(screen.getByRole('table')).getAllByRole('cell');
  expect(cells[0]).toHaveTextContent('0517-0920');
  expect(cells[1]).toHaveTextContent(/^$/);
});

it('edits and removes added product cards below the table width threshold', async () => {
  vi.mocked(useElementWidth).mockReturnValue([vi.fn(), 671]);
  const user = userEvent.setup();
  const add = vi.fn();
  render(
    <InventoryAddProductsDialog
      eligible={eligible}
      listed={[]}
      canManageLots={false}
      unit="DOSES"
      onClose={vi.fn()}
      onAdd={add}
    />,
  );
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  await choose(user, 'stock-events.product', 'Product');
  await choose(user, 'stock-events.lot-code', 'Batch');
  await user.click(screen.getByRole('button', { name: 'stock-events.add' }));
  const card = screen.getByRole('listitem');
  expect(within(card).getByText('Product (P)')).toBeInTheDocument();
  expect(within(card).getByText('Batch')).toBeInTheDocument();
  expect(within(card).getByText('stock-events.expiry-date')).toBeInTheDocument();
  expect(within(card).getByText('-')).toBeInTheDocument();
  await user.type(within(card).getByRole('textbox', { name: 'stock-events.field-of' }), '-1.٢x۳');
  await user.click(screen.getByRole('button', { name: 'physical-inventory.add-items' }));
  expect(add).toHaveBeenCalledWith([
    expect.objectContaining({
      quantity: expect.objectContaining({ doses: '123' }),
      lot: eligible[0].lot,
    }),
  ]);
  await user.click(within(card).getByRole('button', { name: 'stock-events.field-of' }));
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'physical-inventory.add-items' })).toBeDisabled();
});
