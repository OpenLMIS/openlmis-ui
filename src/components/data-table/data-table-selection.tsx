import type { Row, RowData, Table } from '@tanstack/react-table';
import { createColumnHelper } from '@tanstack/react-table';
import { XIcon } from 'lucide-react';
import { createContext, type ReactNode, use } from 'react';
import type { DataTableFeatures } from '@/components/data-table/data-table';
import { useDataTableLabels } from '@/components/data-table/data-table-labels';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export const SelectionCheckboxId = createContext<string | undefined>(undefined);

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
      id={use(SelectionCheckboxId)}
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
      id={use(SelectionCheckboxId)}
      checked={row.getIsSelected()}
      disabled={!row.getCanSelect()}
      onCheckedChange={(checked) => row.toggleSelected(checked)}
    />
  );
}

export function selectionColumn<TData extends RowData>(rowLabel: (row: TData) => string) {
  return createColumnHelper<DataTableFeatures, TData>().display({
    id: 'select',
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <SelectPageCheckbox table={table} />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <SelectRowCheckbox label={rowLabel(row.original)} row={row} />
      </div>
    ),
    meta: { className: 'w-10' },
  });
}

export function SelectionBarLabel({ full, short }: { full: string; short: string }) {
  return (
    <>
      <span className="@md/selection:hidden">{short}</span>
      <span className="hidden @md/selection:inline">{full}</span>
    </>
  );
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
        <div className="mx-auto w-full max-w-lg rounded-xl border border-info/30 bg-card shadow-lg">
          <div className="flex items-center gap-2 rounded-xl bg-info/10 p-2 ps-4">
            <span aria-hidden className="min-w-0 truncate font-medium text-sm">
              {labels.selectedCount(count)}
            </span>
            <div className="ms-auto flex shrink-0 gap-2">
              <Button
                aria-label={labels.clearSelection}
                onClick={onClear}
                size="sm"
                variant="secondary"
              >
                <XIcon data-icon="inline-start" />
                <SelectionBarLabel full={labels.clearSelection} short={labels.clear} />
              </Button>
              {children}
            </div>
          </div>
        </div>
      )}
      <span className="sr-only" role="status">
        {count > 0 ? labels.selectedCount(count) : ''}
      </span>
    </div>
  );
}
