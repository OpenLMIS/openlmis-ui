import { fireEvent, render, screen, within } from '@testing-library/react';
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

    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Status');
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

describe('DataTableSelectFilter with an option for no filter', () => {
  it('shows that option as the choice while nothing narrows the rows, with nothing to clear', () => {
    render(
      <DataTableSelectFilter
        allLabel="All"
        label="Type"
        onValueChange={vi.fn()}
        options={options}
        value=""
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Type:All');
    expect(screen.queryByRole('button', { name: 'Clear Type' })).not.toBeInTheDocument();
  });

  it('reports no filter when that option is picked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DataTableSelectFilter
        allLabel="All"
        label="Type"
        onValueChange={onValueChange}
        options={options}
        value="active"
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'All' }));

    expect(onValueChange).toHaveBeenCalledWith('');
  });
});

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

  it('leaves the search to the server when it searches, listing the options as given', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <DataTableComboboxFilter
        label="Zone"
        onSearch={onSearch}
        onValueChange={vi.fn()}
        options={zones}
        value=""
      />,
    );

    await user.type(screen.getByRole('combobox', { name: 'Zone' }), 'chi');

    expect(onSearch).toHaveBeenLastCalledWith('chi');
    expect(screen.getByRole('option', { name: /Gaza/ })).toBeInTheDocument();
  });

  it('searches for nothing once a pick fills the input, so reopening lists afresh', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <DataTableComboboxFilter
        label="Zone"
        onSearch={onSearch}
        onValueChange={vi.fn()}
        options={zones}
        value=""
      />,
    );

    await user.type(screen.getByRole('combobox', { name: 'Zone' }), 'chi');
    await user.click(screen.getByRole('option', { name: /Chibuto/ }));

    expect(onSearch).toHaveBeenLastCalledWith('');
  });

  it('says what the server search is doing when it has nothing to list', async () => {
    const user = userEvent.setup();
    render(
      <DataTableComboboxFilter
        emptyMessage="Searching"
        label="Zone"
        onSearch={vi.fn()}
        onValueChange={vi.fn()}
        options={[]}
        value=""
      />,
    );

    await user.type(screen.getByRole('combobox', { name: 'Zone' }), 'chi');

    expect(await screen.findByText('Searching')).toBeInTheDocument();
  });

  it('keeps each option label and description in its own direction', async () => {
    const user = userEvent.setup();
    render(
      <DataTableComboboxFilter label="Zone" onValueChange={vi.fn()} options={zones} value="" />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Zone' }));
    const gaza = await screen.findByRole('option', { name: /Gaza/ });

    expect(within(gaza).getByText('Gaza')).toHaveAttribute('dir', 'auto');
    expect(within(gaza).getByText('Province')).toHaveAttribute('dir', 'auto');
  });

  it('says above the options what a server search lists', async () => {
    const user = userEvent.setup();
    render(
      <DataTableComboboxFilter
        label="Zone"
        onSearch={vi.fn()}
        onValueChange={vi.fn()}
        options={zones}
        status="Type to find more"
        value=""
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Zone' }));

    expect(await screen.findByText('Type to find more')).toHaveAttribute('role', 'status');
  });
});
