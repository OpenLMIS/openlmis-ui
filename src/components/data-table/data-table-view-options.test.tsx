import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';

const columns = [
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email' },
];

describe('DataTableViewOptions', () => {
  it('hides a column', async () => {
    const onVisibilityChange = vi.fn();
    render(
      <DataTableViewOptions
        columns={columns}
        onVisibilityChange={onVisibilityChange}
        visibility={{}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'View' }));
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Email' }));

    expect(onVisibilityChange).toHaveBeenCalledWith({ email: false });
  });

  it('sorts card layouts from the menu, keeping the other half of the sort', async () => {
    const onValueChange = vi.fn();
    render(
      <DataTableViewOptions
        columns={columns}
        layout="cards"
        onVisibilityChange={vi.fn()}
        sort={{ columns, value: { id: 'name', desc: true }, onValueChange }}
        visibility={{}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'View' }));
    const sortBy = await screen.findByRole('group', { name: 'Sort By' });
    expect(screen.queryByRole('group', { name: '' })).toBeNull();
    await userEvent.click(within(sortBy).getByRole('menuitemradio', { name: 'Email' }));
    expect(onValueChange).toHaveBeenLastCalledWith({ id: 'email', desc: true });

    const order = screen.getByRole('group', { name: 'Sort Order' });
    await userEvent.click(within(order).getByRole('menuitemradio', { name: 'Ascending' }));
    expect(onValueChange).toHaveBeenLastCalledWith({ id: 'name', desc: false });
  });
});
