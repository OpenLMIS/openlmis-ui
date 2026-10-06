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
  const rows = table.getRowModel().rows;
  const selectable = rows.filter((row) => row.getCanSelect());
  const counted = selectable.length > 0 ? selectable : rows;
  const all = counted.length > 0 && counted.every((row) => row.getIsSelected());

  return (
    <Checkbox
      aria-label={labels.selectPage}
      checked={all}
      disabled={selectable.length === 0}
      indeterminate={!all && rows.some((row) => row.getIsSelected())}
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
  children: ReactNode;
};

export function DataTableSelectionBar({ count, onClear, children }: DataTableSelectionBarProps) {
  const labels = useDataTableLabels();

  return (
    <div className="@container/selection sticky bottom-2 z-10 -mb-2 lg:-mb-4">
      {count > 0 && (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2 rounded-xl border bg-card p-2 shadow-lg @md/selection:flex-row @md/selection:items-center @md/selection:ps-4">
          <span aria-hidden className="px-2 pt-1 font-medium text-sm @md/selection:p-0">
            {labels.selectedCount(count)}
          </span>
          <div className="flex gap-2 *:flex-1 @md/selection:ms-auto @md/selection:*:flex-none">
            <Button onClick={onClear} size="sm" variant="secondary">
              <XIcon data-icon="inline-start" />
              {labels.clearSelection}
            </Button>
            {children}
          </div>
        </div>
      )}
      <span className="sr-only" role="status">
        {count > 0 ? labels.selectedCount(count) : ''}
      </span>
    </div>
  );
}
