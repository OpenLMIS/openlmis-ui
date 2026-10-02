import type { Row, RowData, Table } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DataTableFeatures } from '@/components/data-table/data-table';
import { useDataTableLabels } from '@/components/data-table/data-table-labels';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

function SelectPageCheckbox<TData extends RowData>({
  table,
}: {
  table: Table<DataTableFeatures, TData>;
}) {
  const labels = useDataTableLabels();
  const all = table.getIsAllPageRowsSelected();

  return (
    <Checkbox
      aria-label={labels.selectPage}
      checked={all}
      disabled={table.getRowModel().rows.length === 0}
      indeterminate={!all && table.getIsSomePageRowsSelected()}
      onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
    />
  );
}

function SelectRowCheckbox<TData extends RowData>({
  row,
  label,
}: {
  row: Row<DataTableFeatures, TData>;
  label: string;
}) {
  const labels = useDataTableLabels();

  return (
    <Checkbox
      aria-label={labels.selectRow(label)}
      checked={row.getIsSelected()}
      disabled={!row.getCanSelect()}
      onCheckedChange={(checked) => row.toggleSelected(checked)}
    />
  );
}

/** A leading checkbox column; the header picks every row on the page, and `rowLabel` names each row's box. */
export function selectionColumn<TData extends RowData>(rowLabel: (row: TData) => string) {
  return createColumnHelper<DataTableFeatures, TData>().display({
    id: 'select',
    header: ({ table }) => <SelectPageCheckbox table={table} />,
    cell: ({ row }) => <SelectRowCheckbox label={rowLabel(row.original)} row={row} />,
    meta: { className: 'w-10' },
  });
}

type DataTableSelectionBarProps = {
  count: number;
  onClear: () => void;
  /** Actions on the selected rows, e.g. a Delete button. */
  children: ReactNode;
};

/** A bar held at the bottom of the window while rows are selected; the count is announced as it changes. */
export function DataTableSelectionBar({ count, onClear, children }: DataTableSelectionBarProps) {
  const labels = useDataTableLabels();

  return (
    <div className="sticky bottom-4 z-10">
      {count > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 ps-4 shadow-lg">
          <span aria-hidden className="font-medium text-sm">
            {labels.selectedCount(count)}
          </span>
          <Button onClick={onClear} size="sm" variant="ghost">
            <XIcon data-icon="inline-start" />
            {labels.clearSelection}
          </Button>
          <div className="ms-auto flex flex-wrap gap-2">{children}</div>
        </div>
      )}
      <span className="sr-only" role="status">
        {count > 0 ? labels.selectedCount(count) : ''}
      </span>
    </div>
  );
}
