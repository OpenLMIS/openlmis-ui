import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DataTableComboboxFilter,
  DataTableSelectFilter,
} from '@/components/data-table/data-table-filters';

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

const zones = [
  { value: 'z1', label: 'Gaza', description: 'Province' },
  { value: 'z2', label: 'Bilene', description: 'District' },
  { value: 'z3', label: 'Chibuto', description: 'District' },
];

describe('DataTableComboboxFilter', () => {
  it('narrows the options to what is typed and passes on the picked value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DataTableComboboxFilter
        label="Zone"
        onValueChange={onValueChange}
        options={zones}
        value=""
      />,
    );

    await user.type(screen.getByRole('combobox', { name: 'Zone' }), 'chi');
    expect(screen.queryByRole('option', { name: /Gaza/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Chibuto/ }));

    expect(onValueChange).toHaveBeenCalledWith('z3');
  });

  it('shows the picked option and clears it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DataTableComboboxFilter
        label="Zone"
        onValueChange={onValueChange}
        options={zones}
        value="z1"
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Zone' })).toHaveValue('Gaza');
    await user.click(screen.getByRole('button', { name: 'Clear Zone' }));

    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('says so when nothing matches what is typed', async () => {
    const user = userEvent.setup();
    render(
      <DataTableComboboxFilter label="Zone" onValueChange={vi.fn()} options={zones} value="" />,
    );

    await user.type(screen.getByRole('combobox', { name: 'Zone' }), 'xyz');

    expect(await screen.findByText('No Matches')).toBeInTheDocument();
  });
});
