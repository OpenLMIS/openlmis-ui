import type { RowData } from '@tanstack/react-table';
import { type ReactNode, useLayoutEffect, useRef } from 'react';
import {
  DataTable,
  type DataTableInstance,
  DataTablePagerCard,
  DataTableSkeleton,
} from '@/components/data-table/data-table';
import { DataTablePaginationSkeleton } from '@/components/data-table/data-table-pagination';
import { TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { ScrollArea } from '@/components/ui/scroll-area';

export function DialogCardScroll({
  children,
  footer,
  page,
}: {
  children: ReactNode;
  footer?: ReactNode;
  page?: number;
}) {
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = content.current?.closest('[data-slot=scroll-area-viewport]');
    if (page !== undefined && viewport) viewport.scrollTop = 0;
  }, [page]);
  return (
    <div className="flex min-h-32 flex-1 flex-col gap-4">
      <div className="-mx-4 flex min-h-0 flex-1 flex-col">
        <ScrollArea fade height="fill">
          <div className="px-4 py-1" ref={content}>
            {children}
          </div>
        </ScrollArea>
      </div>
      {footer && <DataTablePagerCard>{footer}</DataTablePagerCard>}
    </div>
  );
}

type DialogTableProps<TData extends RowData> = {
  table: DataTableInstance<TData>;
  cards: boolean;
  title: string;
  empty: ReactNode;
  footer?: ReactNode;
  after?: ReactNode;
  busy?: boolean;
  density?: 'comfortable' | 'default' | 'compact';
  layout?: 'fixed' | 'auto';
  height?: 'auto' | 'fill';
};

export function DialogTable<TData extends RowData>({
  table,
  cards,
  title,
  empty,
  footer,
  after,
  busy = false,
  ...tableProps
}: DialogTableProps<TData>) {
  if (cards) {
    return (
      <DialogCardScroll footer={footer} page={table.state.pagination.pageIndex}>
        <div className="flex flex-col gap-4">
          <TableCards busy={busy} empty={empty} surface="flat" table={table} title={title} />
          {after}
        </div>
      </DialogCardScroll>
    );
  }
  return (
    <>
      <DataTable {...tableProps} empty={empty} footer={footer} isStale={busy} table={table} />
      {after}
    </>
  );
}

export function DialogTableSkeleton<TData extends RowData>({
  table,
  cards,
  title,
  rowCount,
  pagination = 'default',
  ...tableProps
}: Pick<DialogTableProps<TData>, 'table' | 'cards' | 'title' | 'density' | 'layout' | 'height'> & {
  rowCount: number;
  pagination?: 'default' | 'centered';
}) {
  if (cards) {
    return (
      <DialogCardScroll footer={<DataTablePaginationSkeleton layout={pagination} />}>
        <TableCardsSkeleton
          pagination={false}
          rowCount={rowCount}
          surface="flat"
          table={table}
          title={title}
        />
      </DialogCardScroll>
    );
  }
  return (
    <DataTableSkeleton {...tableProps} pagination={pagination} rowCount={rowCount} table={table} />
  );
}
