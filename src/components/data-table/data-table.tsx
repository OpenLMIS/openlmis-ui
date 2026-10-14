import {
  type Column,
  columnVisibilityFeature,
  FlexRender,
  type ReactTable,
  type RowData,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table';
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
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
import { cn } from '@/lib/utils';

export type DataTableColumnMeta = {
  /** Width classes, e.g. `w-1/5` or `w-16 xl:w-72`. Columns without any share what is left. */
  className?: string;
};

// The server sorts and pages, so no client row models are registered.
export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnMeta: {} as DataTableColumnMeta,
});

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableInstance<TData extends RowData> = ReactTable<DataTableFeatures, TData>;

type DataTableProps<TData extends RowData> = {
  table: DataTableInstance<TData>;
  columnWidths?: Readonly<Record<string, number>>;
  density?: 'default' | 'comfortable' | 'compact';
  /** `auto` sizes each column to its content instead of keeping widths steady across pages. */
  layout?: 'fixed' | 'auto';
  /** Rendered across the whole body when there are no rows. */
  empty?: ReactNode;
  /** Dims the rows while the next page is loading in the background. */
  isStale?: boolean;
  /** Rendered inside the card below the rows, e.g. `DataTablePagination`. */
  footer?: ReactNode;
  /** `fill` takes the parent's height and scrolls the rows under a sticky header. */
  height?: 'auto' | 'fill';
};

export function DataTable<TData extends RowData>({
  table,
  columnWidths,
  empty,
  isStale = false,
  footer,
  density = 'comfortable',
  layout = 'fixed',
  height = 'auto',
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();

  return (
    <DataTableCard height={height}>
      <div
        aria-busy={isStale}
        className={cn(
          'transition-opacity aria-busy:opacity-60',
          height === 'fill' && 'min-h-0 flex-1',
        )}
        style={
          columnWidths
            ? ({
                '--table-width': `${columns.reduce((total, column) => total + (columnWidths[column.id] ?? 0), 0)}px`,
              } as CSSProperties)
            : undefined
        }
      >
        <Table
          density={density}
          layout={layout}
          scroll={height === 'fill' ? 'both' : 'x'}
          width={columnWidths ? 'measured' : 'full'}
        >
          <DataTableHeader table={table} columnWidths={columnWidths} />
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow data-state={row.getIsSelected() ? 'selected' : undefined} key={row.id}>
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
function DataTableHeader<TData extends RowData>({
  table,
  columnWidths,
}: {
  table: DataTableInstance<TData>;
  columnWidths?: Readonly<Record<string, number>>;
}) {
  return (
    <>
      <colgroup>
        {table.getVisibleLeafColumns().map((column) => (
          <col
            className={cn(
              column.columnDef.meta?.className,
              columnWidths?.[column.id] && 'w-(--column-width)',
            )}
            key={column.id}
            style={
              columnWidths?.[column.id]
                ? ({ '--column-width': `${columnWidths[column.id]}px` } as CSSProperties)
                : undefined
            }
          />
        ))}
      </colgroup>
      <TableHeader surface="muted">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead aria-sort={ariaSort(header.column)} key={header.id}>
                {header.isPlaceholder ? null : typeof header.column.columnDef.header ===
                  'string' ? (
                  <DataTableHeaderLabel>{header.column.columnDef.header}</DataTableHeaderLabel>
                ) : (
                  <FlexRender header={header} />
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
    </>
  );
}

export function DataTableCard({
  children,
  height = 'auto',
}: {
  children: ReactNode;
  height?: 'auto' | 'fill';
}) {
  // A size container, so the pagination lays out by the table's width rather than the window's.
  return (
    <div
      className={cn(
        '@container/table min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs',
        height === 'fill' && 'flex h-full flex-col',
      )}
    >
      {children}
    </div>
  );
}

export function DataTableFooter({ children }: { children: ReactNode }) {
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
  if (!column.getCanSort()) return <DataTableHeaderLabel>{title}</DataTableHeaderLabel>;

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
        <DataTableHeaderLabel>{title}</DataTableHeaderLabel>
        <SortIcon className="text-muted-foreground" data-icon="inline-end" />
      </Button>
    </div>
  );
}

export function DataTableHeaderLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium text-muted-foreground text-2xs uppercase tracking-table-label">
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
  density?: 'default' | 'comfortable' | 'compact';
  layout?: 'fixed' | 'auto';
  height?: 'auto' | 'fill';
  pagination?: 'default' | 'centered';
};

export function DataTableSkeleton<TData extends RowData>({
  table,
  rowCount,
  density = 'comfortable',
  layout = 'fixed',
  height = 'auto',
  pagination = 'default',
}: DataTableSkeletonProps<TData>) {
  const columns = table.getVisibleLeafColumns();
  const rows = Array.from({ length: rowCount }, (_, index) => index);

  return (
    <div aria-busy className={cn(height === 'fill' && 'h-full')}>
      <DataTableCard height={height}>
        <div className={cn(height === 'fill' && 'min-h-0 flex-1')}>
          <Table density={density} layout={layout} scroll={height === 'fill' ? 'both' : 'x'}>
            <DataTableHeader table={table} />
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row}>
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      {column.id === 'select' ? <SkeletonBox /> : <SkeletonBar />}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DataTableFooter>
          <DataTablePaginationSkeleton layout={pagination} />
        </DataTableFooter>
      </DataTableCard>
    </div>
  );
}

function SkeletonBox() {
  return (
    <div className="size-4">
      <Skeleton fill />
    </div>
  );
}

function SkeletonBar() {
  return (
    <div className="flex h-5 items-center">
      <div className="h-4 w-3/4">
        <Skeleton fill />
      </div>
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
  icon?: ReactNode;
};

export function DataTableError({ title, description, onRetry, icon }: DataTableErrorProps) {
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
        icon={icon ?? <AlertTriangleIcon />}
        description={description}
        title={title}
      />
    </DataTableCard>
  );
}
