import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { BoxesIcon, EllipsisIcon, PencilIcon, SearchXIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { formatDateValue } from '@/components/form/date-value';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { lotsListOptions } from '@/features/lots/api/queries';
import {
  CLEARED_LOT_FILTERS,
  hasLotFilters,
  type LotsSearch,
  toLotsQuery,
} from '@/features/lots/lib/search';
import type { LotRow } from '@/features/lots/lib/types';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, LotRow>();

const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;

function createColumns(t: TFunction, language: string, onEdit: (id: string) => void) {
  const date = (value: string | null) => (value ? formatDateValue(value, language) : null);
  return columnHelper.columns([
    columnHelper.accessor((lot) => lot.product?.productCode ?? '', {
      id: 'productCode',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('lots.product-code')} />
      ),
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="flex">
            <span className="min-w-0 truncate" dir="ltr">
              {getValue()}
            </span>
          </span>
        ) : null,
      meta: { className: 'w-40' },
    }),
    columnHelper.accessor((lot) => lot.product?.fullProductName ?? '', {
      id: 'productName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('lots.product-name')} />
      ),
      cell: ({ row, getValue }) =>
        !row.original.product ? (
          muted(t('lots.no-product'))
        ) : getValue() ? (
          <span className="block whitespace-normal break-words" dir="auto">
            {getValue()}
          </span>
        ) : null,
    }),
    columnHelper.accessor('lotCode', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('lots.lot-code')} />,
      cell: ({ getValue }) => (
        <span className="flex">
          <span className="min-w-0 truncate font-medium" dir="ltr">
            {getValue()}
          </span>
        </span>
      ),
      meta: { className: 'w-36 @xl/main:w-44' },
    }),
    columnHelper.accessor('expirationDate', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('lots.expiration-date')} />
      ),
      cell: ({ getValue }) => date(getValue()),
      meta: { className: 'w-36' },
    }),
    columnHelper.accessor('manufactureDate', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('lots.manufacture-date')} />
      ),
      cell: ({ getValue }) => date(getValue()),
      meta: { className: 'w-40' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('lots.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <LotActions lot={row.original} onEdit={onEdit} />,
    }),
  ]);
}

function LotActions({ lot, onEdit }: { lot: LotRow; onEdit: (id: string) => void }) {
  const { t } = useTranslation();
  const menu = useMenuOpensDialog();

  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('lots.actions-for', { lot: lot.lotCode })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" finalFocus={menu.finalFocus} width="auto">
          <DropdownMenuItem onClick={menu.opensDialog(() => onEdit(lot.id))}>
            <PencilIcon />
            {t('lots.edit')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type LotsTableProps = {
  search: LotsSearch;
  onSearchChange: SearchChange<LotsSearch>;
  columnVisibility: ColumnVisibilityState;
  onEdit: (id: string) => void;
};

const NO_LOTS: LotRow[] = [];

const getRowId = (lot: LotRow) => lot.id;

const noop = () => {};

const NO_SORT = { id: 'lotCode', desc: false };

function useLotsTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
}: LotsTableProps & { data: LotRow[]; rowCount: number }) {
  const { t, i18n } = useTranslation();
  const columns = useMemo(
    () => createColumns(t, i18n.language, onEdit),
    [t, i18n.language, onEdit],
  );
  const searchState = useTableSearchState({ search, defaultSort: NO_SORT, onSearchChange });

  return useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
}

export function LotsTableSkeleton({
  search,
  columnVisibility,
}: Pick<LotsTableProps, 'search' | 'columnVisibility'>) {
  const table = useLotsTable({
    data: NO_LOTS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
    onEdit: noop,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function LotsTable({ search, onSearchChange, columnVisibility, onEdit }: LotsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(lotsListOptions(toLotsQuery(deferredSearch)));
  const table = useLotsTable({
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
    onEdit,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
    }
  }, [isPastLastPage, data.totalPages, onSearchChange]);

  const empty = hasLotFilters(deferredSearch) ? (
    <DataTableEmpty
      action={
        <Button onClick={() => onSearchChange(CLEARED_LOT_FILTERS)} variant="destructive">
          {t('lots.clear-filters')}
        </Button>
      }
      description={t('lots.no-results-description')}
      icon={<SearchXIcon />}
      title={t('lots.no-results-title')}
    />
  ) : (
    <DataTableEmpty
      description={t('lots.empty-description')}
      icon={<BoxesIcon />}
      title={t('lots.empty-title')}
    />
  );

  return (
    <DataTable
      empty={!isPastLastPage && empty}
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
