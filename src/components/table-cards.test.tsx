import { createColumnHelper, useTable } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { type DataTableFeatures, dataTableFeatures } from '@/components/data-table/data-table';
import { CellText, TableCards } from '@/components/table-cards';

type Row = { id: string; name: string; code: string; zone: string | null; type: string };

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
  helper.accessor('type', { header: 'Type', meta: { label: 'Type' } }),
  helper.display({
    id: 'actions',
    cell: ({ row }) => <button type="button">{`Actions for ${row.original.name}`}</button>,
  }),
]);
const rows: Row[] = [
  { id: '1', name: 'Comfort Health Clinic', code: 'HC01', zone: null, type: 'Clinic' },
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

it('puts the title and actions in the band and every other visible column in a row', () => {
  render(<Harness />);
  const card = screen.getByRole('listitem');

  const title = within(card).getByText('Comfort Health Clinic');
  expect(title).not.toHaveClass('truncate');
  expect(
    within(card).getByRole('button', { name: 'Actions for Comfort Health Clinic' }),
  ).toBeVisible();
  expect(
    within(card).getByText('Code').parentElement?.parentElement?.parentElement,
  ).toHaveTextContent('CodeHC01');
  expect(
    within(card).getByText('Zone').parentElement?.parentElement?.parentElement,
  ).toHaveTextContent('Zone-');
  expect(within(card).queryByText('Type')).toBeNull();
  expect(within(card).queryByText('Name')).toBeNull();
});
