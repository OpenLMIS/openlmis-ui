import { createColumnHelper, useTable } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { type DataTableFeatures, dataTableFeatures } from '@/components/data-table/data-table';
import { CellText, TableCards } from '@/components/table-cards';
import { EMPTY_VALUE } from '@/lib/empty-value';

type Row = {
  id: string;
  name: string;
  code: string;
  zone: string | null;
  note: string;
  type: string;
};

const helper = createColumnHelper<DataTableFeatures, Row>();
const columns = helper.columns([
  helper.accessor('name', {
    header: 'Name',
    cell: ({ getValue }) => <CellText strong>{getValue()}</CellText>,
  }),
  helper.accessor('code', { header: 'Code', meta: { label: 'Code' } }),
  helper.accessor('zone', {
    header: 'Zone',
    meta: { label: 'Zone' },
    cell: ({ getValue }) => getValue(),
  }),
  helper.accessor('note', {
    header: 'Note',
    meta: { label: 'Note' },
    cell: ({ getValue }) => getValue() && <CellText>{getValue()}</CellText>,
  }),
  helper.accessor('type', { header: 'Type', meta: { label: 'Type' } }),
  helper.display({
    id: 'actions',
    cell: ({ row }) => <button type="button">{`Actions for ${row.original.name}`}</button>,
  }),
]);
const rows: Row[] = [
  { id: '1', name: 'Comfort Health Clinic', code: 'HC01', zone: null, note: '', type: 'Clinic' },
];

function Harness() {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    state: { columnVisibility: { type: false } },
  });
  return <TableCards table={table} title="name" />;
}

it('puts the title and actions in the band and every other visible column in an isolated row', () => {
  render(<Harness />);
  const card = screen.getByRole('listitem');

  expect(card.textContent).toBe(
    `Comfort Health ClinicActions for Comfort Health ClinicCodeHC01Zone${EMPTY_VALUE}Note${EMPTY_VALUE}`,
  );
  expect(within(card).getByText('Comfort Health Clinic')).not.toHaveClass('truncate');
  expect(within(card).getByText('HC01').closest('bdi')).not.toBeNull();
});
