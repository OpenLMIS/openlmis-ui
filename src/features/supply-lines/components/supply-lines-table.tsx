import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, EyeIcon, RouteIcon, SearchXIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { CellText, TableCards, TableCardsSkeleton, useInCards } from '@/components/table-cards';
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
import { usePageStart } from '@/hooks/use-page-start';
import { markDialogOpened } from '@/hooks/use-search-navigation';
import { tableValue } from '@/lib/empty-value';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, SupplyLine>();

function text(value: string | null, strong = false) {
  if (!tableValue(value)) return null;
  return (
    <CellText overflow="nowrap" strong={strong}>
      {value}
    </CellText>
  );
}

function createColumns(t: TFunction, listSearch: SupplyLinesSearch) {
  return columnHelper.columns([
    columnHelper.accessor('supplyingFacility.name', {
      id: 'supplyingFacility.name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supply-lines.supplying-facility')} />
      ),
      cell: ({ getValue }) => text(getValue() ?? null, true),
      enableHiding: false,
    }),
    columnHelper.accessor('supervisoryNode.code', {
      id: 'supervisoryNode.code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supply-lines.supervisory-node')} />
      ),
      cell: ({ row }) =>
        row.original.supervisoryNode?.id && row.original.supervisoryNode.code ? (
          <ServedFacilitiesPopover line={row.original} />
        ) : null,
      meta: { label: t('supply-lines.supervisory-node') },
    }),
    columnHelper.accessor('program.name', {
      id: 'program.name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supply-lines.program')} />
      ),
      cell: ({ getValue }) => text(getValue() ?? null),
      meta: { label: t('supply-lines.program') },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
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
  const label = t('supply-lines.actions-for', {
    supplier: node.supplyingFacility?.name ?? '',
    node: node.supervisoryNode?.code ?? '',
    program: node.program?.name ?? '',
  });

  if (useInCards()) {
    return (
      <CardActions
        label={label}
        actions={[
          {
            id: 'view',
            icon: <EyeIcon />,
            label: t('supply-lines.view'),
            link: (
              <Link
                search={{ ...listSearch, supplyLine: node.id }}
                state={markDialogOpened}
                resetScroll={false}
                to="/administration/supply-lines"
              />
            ),
          },
        ]}
      />
    );
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button aria-label={label} size="icon-sm" variant="ghost" />}>
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" width="auto">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link
                  search={{ ...listSearch, supplyLine: node.id }}
                  state={markDialogOpened}
                  resetScroll={false}
                  to="/administration/supply-lines"
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
  cards: boolean;
  search: SupplyLinesSearch;
  onSearchChange: SearchChange<SupplyLinesSearch>;
  columnVisibility: ColumnVisibilityState;
};

const NO_SUPPLY_LINES: SupplyLine[] = [];
const getRowId = (node: SupplyLine) => node.id;
const noop = () => {};

function useSupplyLinesTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: SupplyLinesTableProps & { data: SupplyLine[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, search), [t, search]);
  const { pageIndex, pageSize } = toPaginationState(search);
  const pageStart = usePageStart<HTMLUListElement>(`${pageIndex}:${pageSize}`, cards);
  const onTableChange = useCallback<SearchChange<SupplyLinesSearch>>(
    (update) => onSearchChange(update, false, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_SUPPLY_LINES_SORT,
    onSearchChange: onTableChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    ...searchState,
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
    state: { ...searchState.state, columnVisibility },
  });
  return { table, pageStart };
}

export function SupplyLinesTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<SupplyLinesTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useSupplyLinesTable({
    cards: false,
    data: NO_SUPPLY_LINES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards) {
    return <TableCardsSkeleton rowCount={rowCount} table={table} title="supplyingFacility.name" />;
  }
  return <DataTableSkeleton layout="auto" rowCount={rowCount} table={table} />;
}

export function SupplyLinesTable({
  cards,
  search,
  onSearchChange,
  columnVisibility,
}: SupplyLinesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(supplyLinesPageOptions(toSupplyLinesQuery(deferredSearch)));
  const { table, pageStart } = useSupplyLinesTable({
    cards,
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
  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferredSearch;
  if (cards) {
    return (
      <TableCards
        busy={isStale}
        empty={!isPastLastPage && empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="supplyingFacility.name"
      />
    );
  }
  return (
    <DataTable
      layout="auto"
      empty={!isPastLastPage && empty}
      footer={footer}
      isStale={isStale}
      table={table}
    />
  );
}
