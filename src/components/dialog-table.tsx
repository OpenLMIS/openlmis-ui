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

function DialogCards({
  children,
  footer,
  page,
}: {
  children: ReactNode;
  footer?: ReactNode;
  page?: number;
}) {
  const content = useRef<HTMLDivElement>(null);
  const shownPage = useRef(page);
  const requested = useRef(false);
  useLayoutEffect(() => {
    if (page === shownPage.current) return;
    shownPage.current = page;
    if (!requested.current) return;
    requested.current = false;
    content.current?.scrollIntoView?.({ block: 'start' });
  }, [page]);
  const request = () => {
    requested.current = true;
  };
  return (
    <div className="flex scroll-mt-1 flex-col gap-4" ref={content}>
      {children}
      {footer && (
        <div className="contents" onClickCapture={request}>
          <DataTablePagerCard>{footer}</DataTablePagerCard>
        </div>
      )}
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
      <DialogCards footer={footer} page={table.state.pagination.pageIndex}>
        <div className="flex flex-col gap-4">
          <TableCards busy={busy} empty={empty} surface="flat" table={table} title={title} />
          {after}
        </div>
      </DialogCards>
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
      <DialogCards footer={<DataTablePaginationSkeleton layout={pagination} />}>
        <TableCardsSkeleton
          pagination={false}
          rowCount={rowCount}
          surface="flat"
          table={table}
          title={title}
        />
      </DialogCards>
    );
  }
  return (
    <DataTableSkeleton {...tableProps} pagination={pagination} rowCount={rowCount} table={table} />
  );
}
