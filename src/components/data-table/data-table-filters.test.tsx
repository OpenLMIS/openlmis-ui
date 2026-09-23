import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';

const options = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

describe('DataTableSelectFilter', () => {
  it('shows only the label, with nothing to clear, while no option is picked', () => {
    render(
      <DataTableSelectFilter label="Status" onValueChange={vi.fn()} options={options} value="" />,
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Status');
    expect(screen.queryByRole('button', { name: 'Clear Status' })).not.toBeInTheDocument();
  });

  it('shows the pick after the label and clears it', () => {
    const onValueChange = vi.fn();
    render(
      <DataTableSelectFilter
        label="Status"
        onValueChange={onValueChange}
        options={options}
        value="active"
      />,
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Status:Active');
    fireEvent.click(screen.getByRole('button', { name: 'Clear Status' }));

    expect(onValueChange).toHaveBeenCalledWith('');
  });
});
