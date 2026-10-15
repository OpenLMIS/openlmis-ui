import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, EyeIcon, RouteIcon, SearchXIcon } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supplyLinesPageOptions } from '@/features/supply-lines/api/queries';
import { ServedFacilitiesPopover } from '@/features/supply-lines/components/served-facilities-popover';
import {
  CLEARED_SUPPLY_LINE_FILTERS,
  DEFAULT_SUPPLY_LINES_SORT,
  hasSupplyLineFilters,
  type SupplyLinesSearch,
  toSupplyLinesQuery,
} from '@/features/supply-lines/lib/search';
import type { SupplyLine } from '@/features/supply-lines/lib/types';
import { tableValue } from '@/lib/empty-value';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, SupplyLine>();

function text(value: string | null, dir: 'auto' | 'ltr' = 'auto', strong = false) {
  if (!tableValue(value)) return null;
  return (
    <span className="flex">
      <span className={strong ? 'whitespace-nowrap font-medium' : 'whitespace-nowrap'} dir={dir}>
        {value}
      </span>
    </span>
  );
}

function createColumns(t: TFunction, listSearch: SupplyLinesSearch) {
  return columnHelper.columns([
    columnHelper.accessor('supplyingFacility.name', {
      id: 'supplyingFacility.name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supply-lines.supplying-facility')} />
      ),
      cell: ({ getValue }) => text(getValue() ?? null, 'auto', true),
      enableHiding: false,
    }),
    columnHelper.accessor('supervisoryNode.code', {
      id: 'supervisoryNode.code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supply-lines.supervisory-node')} />
      ),
      cell: ({ row }) => <ServedFacilitiesPopover line={row.original} />,
    }),
    columnHelper.accessor('program.name', {
      id: 'program.name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supply-lines.program')} />
      ),
      cell: ({ getValue }) => text(getValue() ?? null),
    }),
    columnHelper.display({
      id: 'actions',
      header: t('supply-lines.actions'),
      meta: { className: 'w-16' },
      enableHiding: false,
      cell: ({ row }) => <SupplyLineActions node={row.original} listSearch={listSearch} />,
    }),
  ]);
}

function SupplyLineActions({
  node,
  listSearch,
}: {
  node: SupplyLine;
  listSearch: SupplyLinesSearch;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('supply-lines.actions-for', {
                supplier: node.supplyingFacility?.name ?? '',
                node: node.supervisoryNode?.code ?? '',
                program: node.program?.name ?? '',
              })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" width="auto">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link
                  params={{ id: node.id }}
                  search={listSearch}
                  state={{ supplyLinesListSearch: listSearch }}
                  to="/administration/supply-lines/$id"
                />
              }
            >
              <EyeIcon />
              {t('supply-lines.view')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type SupplyLinesTableProps = {
  search: SupplyLinesSearch;
  onSearchChange: SearchChange<SupplyLinesSearch>;
  columnVisibility: ColumnVisibilityState;
};

const NO_SUPPLY_LINES: SupplyLine[] = [];
const getRowId = (node: SupplyLine) => node.id;
const noop = () => {};

function useSupplyLinesTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: SupplyLinesTableProps & { data: SupplyLine[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, search), [t, search]);
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_SUPPLY_LINES_SORT,
    onSearchChange,
  });
  return useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
}

export function SupplyLinesTableSkeleton({
  search,
  columnVisibility,
}: Pick<SupplyLinesTableProps, 'search' | 'columnVisibility'>) {
  const table = useSupplyLinesTable({
    data: NO_SUPPLY_LINES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  return (
    <DataTableSkeleton layout="auto" rowCount={toPaginationState(search).pageSize} table={table} />
  );
}

export function SupplyLinesTable({
  search,
  onSearchChange,
  columnVisibility,
}: SupplyLinesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(supplyLinesPageOptions(toSupplyLinesQuery(deferredSearch)));
  const table = useSupplyLinesTable({
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;
  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
    }
  }, [isPastLastPage, data.totalPages, onSearchChange]);
  const empty = hasSupplyLineFilters(deferredSearch) ? (
    <DataTableEmpty
      action={
        <Button
          onClick={() => onSearchChange(CLEARED_SUPPLY_LINE_FILTERS, true)}
          variant="destructive"
        >
          {t('supply-lines.clear-filters')}
        </Button>
      }
      description={t('supply-lines.no-results-description')}
      icon={<SearchXIcon />}
      title={t('supply-lines.no-results-title')}
    />
  ) : (
    <DataTableEmpty
      description={t('supply-lines.empty-description')}
      icon={<RouteIcon />}
      title={t('supply-lines.empty-title')}
    />
  );
  return (
    <DataTable
      layout="auto"
      empty={!isPastLastPage && empty}
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
