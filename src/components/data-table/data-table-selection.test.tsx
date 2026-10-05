import { createColumnHelper, type RowSelectionState, useTable } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import {
  DataTableSelectionBar,
  selectionColumn,
} from '@/components/data-table/data-table-selection';

type Row = { id: string; name: string };

const helper = createColumnHelper<DataTableFeatures, Row>();
const columns = helper.columns([
  selectionColumn<Row>((row) => row.name),
  helper.accessor('name', { header: 'Name' }),
]);
const firstPage: Row[] = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Grace' },
];
const secondPage: Row[] = [{ id: '3', name: 'Linus' }];

function Harness({ initial = {} }: { initial?: RowSelectionState }) {
  const [data, setData] = useState(firstPage);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(initial);
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row) => row.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });
  return (
    <>
      <DataTable table={table} />
      <button onClick={() => setData(secondPage)} type="button">
        Next
      </button>
      <output>{Object.keys(rowSelection).sort().join(',')}</output>
    </>
  );
}

describe('selectionColumn', () => {
  it('selects one row, named after it, and marks the row selected', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Grace' }));

    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('2');
    expect(screen.getByRole('checkbox', { name: 'Select Grace' })).toBeChecked();
    expect(screen.getByRole('row', { name: /Grace/ })).toHaveAttribute('data-state', 'selected');
  });

  it('selects every row on the page from the header, which is mixed while part of it is', async () => {
    render(<Harness initial={{ '1': true }} />);
    const all = screen.getByRole('checkbox', { name: 'Select Page' });

    expect(all).toHaveAttribute('aria-checked', 'mixed');
    await userEvent.click(all);

    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('1,2');
    expect(all).toBeChecked();
  });

  it('keeps rows picked on another page when the page changes', async () => {
    render(<Harness initial={{ '1': true }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Linus' }));

    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('1,3');
    expect(screen.getByRole('checkbox', { name: 'Select Page' })).toBeChecked();
  });
});

describe('DataTableSelectionBar', () => {
  it('says how many are selected, with Clear and the actions given', async () => {
    const onClear = vi.fn();
    render(
      <DataTableSelectionBar count={3} onClear={onClear}>
        <button type="button">Delete</button>
      </DataTableSelectionBar>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('3 Selected');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows no bar with nothing selected, but keeps the announcement region', () => {
    render(
      <DataTableSelectionBar count={0} onClear={vi.fn()}>
        <button type="button">Delete</button>
      </DataTableSelectionBar>,
    );

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
