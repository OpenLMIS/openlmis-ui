import { render, screen } from '@testing-library/react';
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

  it('keeps the last visible column', async () => {
    render(
      <DataTableViewOptions
        columns={columns}
        onVisibilityChange={vi.fn()}
        visibility={{ email: false }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'View' }));

    expect(await screen.findByRole('menuitemcheckbox', { name: 'Name' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
