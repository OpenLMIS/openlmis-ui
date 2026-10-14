import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DataTableFilters } from './data-table-filters-popover';

it('counts active filters and enables Clear Filters only while some are active', async () => {
  const onClear = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(
    <DataTableFilters activeCount={0} onClear={onClear}>
      <input aria-label="Zone" />
    </DataTableFilters>,
  );

  await user.click(screen.getByRole('button', { name: 'Filters' }));
  expect(await screen.findByRole('textbox', { name: 'Zone' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Clear Filters' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );

  rerender(
    <DataTableFilters activeCount={2} onClear={onClear}>
      <input aria-label="Zone" />
    </DataTableFilters>,
  );
  expect(screen.getByRole('button', { name: 'Filters 2 active filters' })).toBeInTheDocument();
  const clear = screen.getByRole('button', { name: 'Clear Filters' });
  await user.click(clear);
  expect(onClear).toHaveBeenCalledOnce();

  rerender(
    <DataTableFilters activeCount={0} onClear={onClear}>
      <input aria-label="Zone" />
    </DataTableFilters>,
  );
  expect(clear).toHaveFocus();
});
