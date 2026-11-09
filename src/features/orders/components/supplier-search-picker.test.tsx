import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SupplierSearchPicker } from '@/features/orders/components/supplier-search-picker';

const options = Array.from({ length: 1009 }, (_, index) => ({
  id: `supplier-${index}`,
  name: `Warehouse ${index}`,
  code: `S${index}`,
  active: true,
}));

it('limits rendered matches while keeping every supplier searchable', async () => {
  const user = userEvent.setup();
  const onSearch = vi.fn();
  render(<SupplierSearchPicker options={options} onDraftChange={vi.fn()} onSearch={onSearch} />);
  const picker = screen.getByRole('combobox', { name: /orders.view.supplier/ });
  await user.click(picker);
  expect(screen.getAllByRole('option')).toHaveLength(50);
  await user.type(picker, 'Warehouse 1008');
  await user.click(await screen.findByRole('option', { name: /Warehouse 1008/ }));
  await user.click(screen.getByRole('button', { name: 'facility-program.search' }));
  expect(onSearch).toHaveBeenCalledWith('supplier-1008');
});

it.each(['sole', 'applied'] as const)('keeps the %s supplier selected for Search', async (kind) => {
  const user = userEvent.setup();
  const onSearch = vi.fn();
  render(
    <SupplierSearchPicker
      options={kind === 'sole' ? [options[1008]] : options}
      applied={kind === 'applied' ? options[1008].id : undefined}
      onDraftChange={vi.fn()}
      onSearch={onSearch}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'facility-program.search' }));
  expect(onSearch).toHaveBeenCalledWith('supplier-1008');
});

it('reports a cleared supplier distinctly and requires it before Search', async () => {
  const user = userEvent.setup();
  const onDraftChange = vi.fn();
  const onSearch = vi.fn();
  render(
    <SupplierSearchPicker
      options={options}
      applied={options[0].id}
      onDraftChange={onDraftChange}
      onSearch={onSearch}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'orders.view.clear-supplier' }));
  expect(onDraftChange).toHaveBeenLastCalledWith('');
  await user.click(screen.getByRole('button', { name: 'facility-program.search' }));
  expect(await screen.findByText('facility-program.facility-required')).toBeVisible();
  expect(onSearch).not.toHaveBeenCalled();
});
