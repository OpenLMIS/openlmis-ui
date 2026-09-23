import {
  type Column,
  columnVisibilityFeature,
  FlexRender,
  type ReactTable,
  type RowData,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table';
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useDataTableLabels } from '@/components/data-table/data-table-labels';
import { DataTablePaginationSkeleton } from '@/components/data-table/data-table-pagination';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type DataTableColumnMeta = {
  /** Width classes, e.g. `w-1/5` or `w-16 xl:w-72`. Columns without any share what is left. */
  className?: string;
};

// The server sorts and pages, so no client row models are registered.
export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  rowPaginationFeature,
  columnMeta: {} as DataTableColumnMeta,
});

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableInstance<TData extends RowData> = ReactTable<DataTableFeatures, TData>;

type DataTableProps<TData extends RowData> = {
  table: DataTableInstance<TData>;
  /** Rendered across the whole body when there are no rows. */
  empty?: ReactNode;
  /** Dims the rows while the next page is loading in the background. */
  isStale?: boolean;
  /** Rendered inside the card below the rows, e.g. `DataTablePagination`. */
  footer?: ReactNode;
};

export function DataTable<TData extends RowData>({
  table,
  empty,
  isStale = false,
  footer,
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();

  return (
    <DataTableCard>
      <div aria-busy={isStale} className="transition-opacity aria-busy:opacity-60">
        {/* Fixed widths keep the columns still from page to page. */}
        <Table density="comfortable" layout="fixed">
          <DataTableHeader table={table} />
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <div className="whitespace-normal">{empty}</div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {footer && <DataTableFooter>{footer}</DataTableFooter>}
    </DataTableCard>
  );
}

/** Column widths and the header row, shared by the table and its skeleton so neither shifts. */
function DataTableHeader<TData extends RowData>({ table }: { table: DataTableInstance<TData> }) {
  return (
    <>
      <colgroup>
        {table.getVisibleLeafColumns().map((column) => (
          <col className={column.columnDef.meta?.className} key={column.id} />
        ))}
      </colgroup>
      <TableHeader surface="muted">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead aria-sort={ariaSort(header.column)} key={header.id}>
                {header.isPlaceholder ? null : <FlexRender header={header} />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
    </>
  );
}

function DataTableCard({ children }: { children: ReactNode }) {
  // A size container, so the pagination lays out by the table's width rather than the window's.
  return (
    <div className="@container/table overflow-hidden rounded-xl border bg-card shadow-xs">
      {children}
    </div>
  );
}

function DataTableFooter({ children }: { children: ReactNode }) {
  return <div className="border-t bg-muted/30 px-4 py-3">{children}</div>;
}

function ariaSort<TData extends RowData>(column: Column<DataTableFeatures, TData>) {
  if (!column.getCanSort()) return undefined;
  const direction = column.getIsSorted();
  if (direction === 'asc') return 'ascending';
  if (direction === 'desc') return 'descending';
  return 'none';
}

type DataTableColumnHeaderProps<TData extends RowData, TValue> = {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
};

/** Header label that toggles the column's sort when the column allows it. */
export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) return <HeaderLabel>{title}</HeaderLabel>;

  const direction = column.getIsSorted();
  const SortIcon =
    direction === 'asc'
      ? ChevronUpIcon
      : direction === 'desc'
        ? ChevronDownIcon
        : ChevronsUpDownIcon;

  return (
    <div className="-ms-2">
      <Button onClick={column.getToggleSortingHandler()} size="xs" variant="ghost">
        <HeaderLabel>{title}</HeaderLabel>
        <SortIcon className="text-muted-foreground" data-icon="inline-end" />
      </Button>
    </div>
  );
}

function HeaderLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium text-muted-foreground text-xs uppercase tracking-label">
      {children}
    </span>
  );
}

export function DataTableToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

type DataTableSkeletonProps<TData extends RowData> = {
  /** A table built from the real columns with no rows, so the header and widths match exactly. */
  table: DataTableInstance<TData>;
  rowCount: number;
};

export function DataTableSkeleton<TData extends RowData>({
  table,
  rowCount,
}: DataTableSkeletonProps<TData>) {
  const columns = table.getVisibleLeafColumns();
  const rows = Array.from({ length: rowCount }, (_, index) => index);

  return (
    <div aria-busy>
      <DataTableCard>
        <Table density="comfortable" layout="fixed">
          <DataTableHeader table={table} />
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row}>
                {columns.map((column) => (
                  <TableCell key={column.id}>
                    <SkeletonBar />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DataTableFooter>
          <DataTablePaginationSkeleton />
        </DataTableFooter>
      </DataTableCard>
    </div>
  );
}

function SkeletonBar() {
  return (
    <div className="h-4 w-3/4">
      <Skeleton fill />
    </div>
  );
}

type DataTableEmptyProps = {
  icon?: ReactNode;
  title: string;
  description?: string | undefined;
  action?: ReactNode;
};

export function DataTableEmpty({ icon, title, description, action }: DataTableEmptyProps) {
  return (
    <Empty>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

type DataTableErrorProps = {
  title: string;
  description?: string;
  onRetry?: () => void;
};

export function DataTableError({ title, description, onRetry }: DataTableErrorProps) {
  const labels = useDataTableLabels();

  return (
    <DataTableCard>
      <DataTableEmpty
        action={
          onRetry && (
            <Button onClick={onRetry} size="sm" variant="outline">
              {labels.retry}
            </Button>
          )
        }
        icon={<AlertTriangleIcon />}
        description={description}
        title={title}
      />
    </DataTableCard>
  );
}
