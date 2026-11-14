import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { FulfillOrdersSort } from '@/features/orders/components/fulfill-orders-sort';
import { toOrderParams } from '@/features/orders/lib/order-search';

it('switches date order from another sort, resets paging and preserves filters', async () => {
  const user = userEvent.setup();
  const search = {
    page: 3,
    sort: 'orderCode' as const,
    dir: 'asc' as const,
    status: 'ORDERED' as const,
  };
  const onSearchChange = vi.fn();
  const { rerender } = render(
    <FulfillOrdersSort search={search} onSearchChange={onSearchChange} />,
  );
  await user.click(screen.getByRole('combobox', { name: 'data-table.sort-by' }));
  await user.click(await screen.findByRole('option', { name: 'orders.fulfill.sort-oldest' }));
  expect(onSearchChange).toHaveBeenLastCalledWith({
    sort: 'createdDate',
    dir: 'asc',
    page: undefined,
  });
  const oldest = { ...search, ...onSearchChange.mock.lastCall?.[0] };
  expect(toOrderParams(oldest, 'fulfill')).toMatchObject({
    page: 0,
    status: ['ORDERED'],
    sort: ['createdDate,asc', 'id,asc'],
  });
  rerender(<FulfillOrdersSort search={oldest} onSearchChange={onSearchChange} />);
  await user.click(screen.getByRole('combobox', { name: 'data-table.sort-by' }));
  await user.click(await screen.findByRole('option', { name: 'orders.fulfill.sort-newest' }));
  expect(onSearchChange).toHaveBeenLastCalledWith({
    sort: undefined,
    dir: undefined,
    page: undefined,
  });
});
