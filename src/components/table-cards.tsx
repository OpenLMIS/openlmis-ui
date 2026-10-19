import type { Cell, Row, RowData } from '@tanstack/react-table';
import { createContext, type ReactNode, type Ref, use } from 'react';
import {
  CardBand,
  CardList,
  CardListItem,
  CardListSkeleton,
  CardRows,
  SkeletonBar,
} from '@/components/card-list';
import type { DataTableFeatures, DataTableInstance } from '@/components/data-table/data-table';
import { SettingsItem } from '@/components/form/settings-list';
import { Skeleton } from '@/components/ui/skeleton';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { cn } from '@/lib/utils';

const InCardContext = createContext(false);

const ACTIONS = 'actions';
const SELECT = 'select';

type TableCardsProps<TData extends RowData> = {
  table: DataTableInstance<TData>;
  title: string;
  empty?: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  listRef?: Ref<HTMLUListElement>;
};

export function TableCards<TData extends RowData>({
  table,
  title,
  empty,
  footer,
  busy = false,
  listRef,
}: TableCardsProps<TData>) {
  const rows = table.getRowModel().rows;
  return (
    <InCardContext value={true}>
      <CardList busy={busy} empty={rows.length === 0 && empty} footer={footer} listRef={listRef}>
        {rows.map((row) => (
          <TableCard key={row.id} row={row} title={title} />
        ))}
      </CardList>
    </InCardContext>
  );
}

function renderCell<TData extends RowData>(cell: Cell<DataTableFeatures, TData, unknown>) {
  const render = cell.column.columnDef.cell;
  const content: ReactNode = typeof render === 'function' ? render(cell.getContext()) : render;
  return content === null || content === undefined || content === false || content === ''
    ? EMPTY_VALUE
    : content;
}

const isDetail = (id: string, title: string) => id !== title && id !== ACTIONS && id !== SELECT;

function TableCard<TData extends RowData>({
  row,
  title,
}: {
  row: Row<DataTableFeatures, TData>;
  title: string;
}) {
  const cells = row.getVisibleCells();
  const titleCell = cells.find((cell) => cell.column.id === title);
  const actions = cells.find((cell) => cell.column.id === ACTIONS);
  const details = cells.filter((cell) => isDetail(cell.column.id, title));
  return (
    <CardListItem>
      <CardBand>
        <div className="min-w-0 wrap-anywhere">
          <bdi>{titleCell && renderCell(titleCell)}</bdi>
        </div>
        {actions && <div className="shrink-0">{renderCell(actions)}</div>}
      </CardBand>
      {details.length > 0 && (
        <CardRows>
          {details.map((cell) => (
            <SettingsItem key={cell.id} label={cell.column.columnDef.meta?.label ?? cell.column.id}>
              {renderCell(cell)}
            </SettingsItem>
          ))}
        </CardRows>
      )}
    </CardListItem>
  );
}

export function TableCardsSkeleton<TData extends RowData>({
  table,
  title,
  rowCount,
}: {
  table: DataTableInstance<TData>;
  title: string;
  rowCount: number;
}) {
  const columns = table.getVisibleLeafColumns();
  const actions = columns.find((column) => column.id === ACTIONS);
  return (
    <div aria-busy>
      <CardListSkeleton
        count={Math.min(3, rowCount)}
        rows={columns.filter((column) => isDetail(column.id, title)).length}
        band={
          <>
            <SkeletonBar width="w-24" />
            {actions && (
              <div
                className={actions.columnDef.meta?.skeleton === 'control' ? 'h-7 w-16' : 'size-7'}
              >
                <Skeleton fill />
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

export function CellText({
  children,
  dir = 'auto',
  strong = false,
}: {
  children: ReactNode;
  dir?: 'auto' | 'ltr';
  strong?: boolean;
}) {
  if (use(InCardContext)) return <span dir={dir}>{children}</span>;
  return (
    <span className="flex">
      <span className={cn('min-w-0 truncate', strong && 'font-medium')} dir={dir}>
        {children}
      </span>
    </span>
  );
}
