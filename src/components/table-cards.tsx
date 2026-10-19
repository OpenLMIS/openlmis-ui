import { type Cell, flexRender, type Row, type RowData } from '@tanstack/react-table';
import { createContext, type ReactNode, type Ref, use, useId } from 'react';
import {
  CardBand,
  CardList,
  CardListItem,
  CardListSkeleton,
  CardRows,
  CardSelectBand,
  SkeletonBar,
} from '@/components/card-list';
import type { DataTableFeatures, DataTableInstance } from '@/components/data-table/data-table';
import { useDataTableLabels } from '@/components/data-table/data-table-labels';
import { SelectionCheckboxId } from '@/components/data-table/data-table-selection';
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
  heading?: (row: TData) => string | undefined;
  surface?: 'raised' | 'flat';
};

export function useInCards() {
  return use(InCardContext);
}

export function TableCards<TData extends RowData>({
  table,
  title,
  empty,
  footer,
  busy = false,
  listRef,
  heading,
  surface = 'raised',
}: TableCardsProps<TData>) {
  const rows = table.getRowModel().rows;
  const ids = useId();
  const selectHeader = table.getFlatHeaders().find((header) => header.column.id === SELECT);
  const list = (
    <CardList busy={busy} empty={rows.length === 0 && empty} footer={footer} listRef={listRef}>
      {rows.map((row) => {
        const text = heading?.(row.original);
        if (text !== undefined) {
          return (
            <li key={row.id}>
              <h2 className="px-1 pt-2 font-semibold text-base">
                <bdi>{text}</bdi>
              </h2>
            </li>
          );
        }
        return (
          <TableCard
            key={row.id}
            row={row}
            selectId={`${ids}-${row.id}`}
            surface={surface}
            title={title}
          />
        );
      })}
    </CardList>
  );
  return (
    <InCardContext value={true}>
      {selectHeader?.column.getIsVisible() && rows.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-3">
          <SelectPage id={`${ids}-page`}>
            {flexRender(selectHeader.column.columnDef.header, selectHeader.getContext())}
          </SelectPage>
          {list}
        </div>
      ) : (
        list
      )}
    </InCardContext>
  );
}

function SelectPage({ id, children }: { id: string; children: ReactNode }) {
  const labels = useDataTableLabels();
  return (
    <label className="flex w-fit cursor-pointer items-center gap-3 px-4 text-sm" htmlFor={id}>
      <SelectionCheckboxId value={id}>{children}</SelectionCheckboxId>
      <span aria-hidden>{labels.selectPage}</span>
    </label>
  );
}

function cellContent<TData extends RowData>(cell: Cell<DataTableFeatures, TData, unknown>) {
  const render = cell.column.columnDef.cell;
  const content: ReactNode = typeof render === 'function' ? render(cell.getContext()) : render;
  return content === null || content === undefined || content === false || content === ''
    ? undefined
    : content;
}

function renderCell<TData extends RowData>(cell: Cell<DataTableFeatures, TData, unknown>) {
  return cellContent(cell) ?? EMPTY_VALUE;
}

const isDetail = (id: string, title: string) => id !== title && id !== ACTIONS && id !== SELECT;

function TableCard<TData extends RowData>({
  row,
  title,
  selectId,
  surface,
}: {
  row: Row<DataTableFeatures, TData>;
  title: string;
  selectId: string;
  surface: 'raised' | 'flat';
}) {
  const cells = row.getVisibleCells();
  const titleCell = cells.find((cell) => cell.column.id === title);
  const actions = cells.find((cell) => cell.column.id === ACTIONS);
  const select = cells.find((cell) => cell.column.id === SELECT);
  const details = cells.filter((cell) => isDetail(cell.column.id, title));
  const actionContent = actions && cellContent(actions);
  const action = actionContent && <div className="shrink-0">{actionContent}</div>;
  return (
    <CardListItem surface={surface}>
      {select ? (
        <CardSelectBand
          action={action}
          disabled={!row.getCanSelect()}
          htmlFor={selectId}
          selected={row.getIsSelected()}
        >
          <SelectionCheckboxId value={selectId}>{renderCell(select)}</SelectionCheckboxId>
          <div aria-hidden className="min-w-0 font-medium wrap-anywhere">
            <bdi>{titleCell && renderCell(titleCell)}</bdi>
          </div>
        </CardSelectBand>
      ) : (
        <CardBand>
          <div className="min-w-0 font-medium wrap-anywhere">
            <bdi>{titleCell && renderCell(titleCell)}</bdi>
          </div>
          {action}
        </CardBand>
      )}
      {details.length > 0 && (
        <CardRows>
          {details.map((cell) => (
            <SettingsItem key={cell.id} label={cell.column.columnDef.meta?.label ?? cell.column.id}>
              <bdi>{renderCell(cell)}</bdi>
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
  surface = 'raised',
  pagination = true,
  titleLines = 1,
}: {
  table: DataTableInstance<TData>;
  title: string;
  rowCount: number;
  surface?: 'raised' | 'flat';
  pagination?: boolean;
  titleLines?: 1 | 2;
}) {
  const columns = table.getVisibleLeafColumns();
  const actions = columns.find((column) => column.id === ACTIONS);
  const select = columns.some((column) => column.id === SELECT);
  return (
    <div aria-busy className="flex min-w-0 flex-col gap-3">
      {select && (
        <div className="flex h-5 items-center gap-3 px-4">
          <div className="size-4">
            <Skeleton fill />
          </div>
          <SkeletonBar width="w-20" />
        </div>
      )}
      <CardListSkeleton
        count={rowCount}
        pagination={pagination}
        surface={surface}
        rows={columns.filter((column) => isDetail(column.id, title)).length}
        band={
          <>
            {select ? (
              <div className="flex items-center gap-3">
                <div className="size-4">
                  <Skeleton fill />
                </div>
                <SkeletonBar width="w-24" />
              </div>
            ) : titleLines === 2 ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <SkeletonBar width="w-full" />
                <SkeletonBar width="w-1/3" />
              </div>
            ) : (
              <SkeletonBar width="w-24" />
            )}
            {actions && (
              <div
                className={actions.columnDef.meta?.skeleton === 'control' ? 'h-7 w-20' : 'size-7'}
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
  overflow = 'truncate',
}: {
  children: ReactNode;
  dir?: 'auto' | 'ltr';
  strong?: boolean;
  overflow?: 'truncate' | 'nowrap' | 'clamp';
}) {
  if (use(InCardContext)) return <span dir={dir}>{children}</span>;
  if (overflow === 'clamp') {
    return (
      <span
        className={cn('line-clamp-2 break-words whitespace-normal', strong && 'font-medium')}
        dir={dir}
      >
        {children}
      </span>
    );
  }
  if (overflow === 'nowrap') {
    return (
      <span className={cn('whitespace-nowrap', strong && 'font-medium')} dir={dir}>
        {children}
      </span>
    );
  }
  return (
    <span className="flex">
      <span className={cn('min-w-0 truncate', strong && 'font-medium')} dir={dir}>
        {children}
      </span>
    </span>
  );
}
