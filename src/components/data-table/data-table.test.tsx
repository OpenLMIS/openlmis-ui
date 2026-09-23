import { createColumnHelper, useTable } from '@tanstack/react-table';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';

type Row = { id: string; name: string; email: string };

const helper = createColumnHelper<DataTableFeatures, Row>();
const columns = helper.columns([
  helper.accessor('name', { header: 'Name', meta: { className: 'w-1/3' } }),
  helper.accessor('email', { header: 'Email' }),
]);
const rows: Row[] = [{ id: '1', name: 'Ada', email: 'ada@example.org' }];

function Harness() {
  const table = useTable({ features: dataTableFeatures, columns, data: rows });
  return <DataTable table={table} />;
}

describe('DataTable', () => {
  it('sizes columns from their declared width rather than their content', () => {
    const { container } = render(<Harness />);
    const cols = [...container.querySelectorAll('col')];

    expect(cols.map((col) => col.className)).toEqual(['w-1/3', '']);
  });
});
