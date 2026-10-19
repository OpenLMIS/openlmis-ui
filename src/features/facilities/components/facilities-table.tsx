import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { BuildingIcon, EllipsisIcon, PencilIcon, PlusIcon, SearchXIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
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
import { FlagBadge } from '@/components/flag-badge';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { facilitiesListOptions } from '@/features/facilities/api/queries';
import {
  CLEARED_FACILITY_FILTERS,
  DEFAULT_FACILITIES_SORT,
  type FacilitiesSearch,
  hasFacilityFilters,
  toFacilitiesQuery,
} from '@/features/facilities/lib/search';
import type { Facility } from '@/features/reference-data/lib/types';
import { usePageStart } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, Facility>();

function text(value: string | null | undefined, dir: 'auto' | 'ltr' = 'auto', strong = false) {
  if (!value) return null;
  return (
    <CellText dir={dir} strong={strong}>
      {value}
    </CellText>
  );
}

function createColumns(t: TFunction, listSearch: FacilitiesSearch) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facilities.name')} />
      ),
      cell: ({ getValue }) => text(getValue(), 'auto', true),
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facilities.code')} />
      ),
      cell: ({ getValue }) => text(getValue(), 'ltr'),
      meta: { className: 'w-28 @xl/main:w-36', label: t('facilities.code') },
    }),
    columnHelper.accessor((facility) => facility.geographicZone?.name, {
      id: 'geographicZone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facilities.zone')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      enableSorting: false,
      meta: { className: '@4xl/main:w-1/6', label: t('facilities.zone') },
    }),
    columnHelper.accessor((facility) => facility.type?.name, {
      id: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facilities.type')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      enableSorting: false,
      meta: { className: '@4xl/main:w-1/6', label: t('facilities.type') },
    }),
    columnHelper.accessor('active', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facilities.active')} />
      ),
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue()}
          trueLabel={t('facilities.status-active')}
          falseLabel={t('facilities.status-inactive')}
        />
      ),
      meta: { className: 'w-32', label: t('facilities.active') },
    }),
    columnHelper.accessor('enabled', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facilities.enabled')} />
      ),
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue()}
          trueLabel={t('facilities.status-enabled')}
          falseLabel={t('facilities.status-disabled')}
        />
      ),
      meta: { className: 'w-32', label: t('facilities.enabled') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('facilities.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <FacilityActions facility={row.original} listSearch={listSearch} />,
    }),
  ]);
}

function FacilityActions({
  facility,
  listSearch,
}: {
  facility: Facility;
  listSearch: FacilitiesSearch;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('facilities.actions-for', { facility: facility.name || facility.code })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" width="auto">
          <DropdownMenuItem
            render={
              <Link
                params={{ id: facility.id }}
                state={{ facilitiesListSearch: listSearch }}
                to="/administration/facilities/$id"
              />
            }
          >
            <PencilIcon />
            {t('facilities.edit')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type FacilitiesTableProps = {
  cards: boolean;
  search: FacilitiesSearch;
  onSearchChange: SearchChange<FacilitiesSearch>;
  columnVisibility: ColumnVisibilityState;
  onAdd: () => void;
};

const NO_FACILITIES: Facility[] = [];

const getRowId = (facility: Facility) => facility.id;

const noop = () => {};

function useFacilitiesTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: Omit<FacilitiesTableProps, 'onAdd'> & { data: Facility[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, search), [t, search]);
  const { pageIndex, pageSize } = toPaginationState(search);
  const pageStart = usePageStart<HTMLUListElement>(`${pageIndex}:${pageSize}`, cards);
  const onTableChange = useCallback<SearchChange<FacilitiesSearch>>(
    (update) => onSearchChange(update, false, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_FACILITIES_SORT,
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
    enableSortingRemoval: false,
    ...searchState,
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
    state: { ...searchState.state, columnVisibility },
  });
  return { table, pageStart };
}

export function FacilitiesTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<FacilitiesTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useFacilitiesTable({
    cards: false,
    data: NO_FACILITIES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });

  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function FacilitiesTable({
  cards,
  search,
  onSearchChange,
  columnVisibility,
  onAdd,
}: FacilitiesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(facilitiesListOptions(toFacilitiesQuery(deferredSearch)));
  const { table, pageStart } = useFacilitiesTable({
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

  const empty = hasFacilityFilters(deferredSearch) ? (
    <DataTableEmpty
      action={
        <Button onClick={() => onSearchChange(CLEARED_FACILITY_FILTERS)} variant="destructive">
          {t('facilities.clear-filters')}
        </Button>
      }
      description={t('facilities.no-results-description')}
      icon={<SearchXIcon />}
      title={t('facilities.no-results-title')}
    />
  ) : (
    <DataTableEmpty
      action={
        <Button onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          {t('facilities.add')}
        </Button>
      }
      description={t('facilities.empty-description')}
      icon={<BuildingIcon />}
      title={t('facilities.empty-title')}
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
        title="name"
      />
    );
  }
  return (
    <DataTable empty={!isPastLastPage && empty} footer={footer} isStale={isStale} table={table} />
  );
}
