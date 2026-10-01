import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { BuildingIcon, CheckIcon, PlusIcon, SearchXIcon, XIcon } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { facilitiesListOptions } from '@/features/facilities/api/queries';
import {
  CLEARED_FACILITY_FILTERS,
  DEFAULT_FACILITIES_SORT,
  type FacilitiesSearch,
  hasFacilityFilters,
  toFacilitiesQuery,
} from '@/features/facilities/lib/search';
import type { Facility } from '@/features/reference-data/lib/types';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, Facility>();

const muted = <span className="text-muted-foreground">-</span>;

function text(value: string | null | undefined, dir: 'auto' | 'ltr' = 'auto', strong = false) {
  if (!value) return muted;
  return (
    <span className="flex">
      <span className={strong ? 'min-w-0 truncate font-medium' : 'min-w-0 truncate'} dir={dir}>
        {value}
      </span>
    </span>
  );
}

function flag(on: boolean, onLabel: string, offLabel: string) {
  return on ? (
    <Badge variant="success">
      <CheckIcon data-icon="inline-start" />
      {onLabel}
    </Badge>
  ) : (
    <Badge variant="destructive">
      <XIcon data-icon="inline-start" />
      {offLabel}
    </Badge>
  );
}

function createColumns(t: TFunction) {
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
      meta: { className: 'w-28 @xl/main:w-36' },
    }),
    columnHelper.accessor((facility) => facility.geographicZone?.name, {
      id: 'geographicZone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facilities.zone')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      enableSorting: false,
      meta: { className: '@4xl/main:w-1/6' },
    }),
    columnHelper.accessor((facility) => facility.type?.name, {
      id: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facilities.type')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      enableSorting: false,
      meta: { className: '@4xl/main:w-1/6' },
    }),
    columnHelper.accessor('active', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facilities.active')} />
      ),
      cell: ({ getValue }) =>
        flag(getValue(), t('facilities.status-active'), t('facilities.status-inactive')),
      meta: { className: 'w-32' },
    }),
    columnHelper.accessor('enabled', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facilities.enabled')} />
      ),
      cell: ({ getValue }) =>
        flag(getValue(), t('facilities.status-enabled'), t('facilities.status-disabled')),
      meta: { className: 'w-32' },
    }),
  ]);
}

type FacilitiesTableProps = {
  search: FacilitiesSearch;
  onSearchChange: SearchChange<FacilitiesSearch>;
  columnVisibility: ColumnVisibilityState;
  onAdd: () => void;
};

const NO_FACILITIES: Facility[] = [];

const getRowId = (facility: Facility) => facility.id;

const noop = () => {};

function useFacilitiesTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: Omit<FacilitiesTableProps, 'onAdd'> & { data: Facility[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t), [t]);
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_FACILITIES_SORT,
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
    enableSortingRemoval: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
}

export function FacilitiesTableSkeleton({
  search,
  columnVisibility,
}: Pick<FacilitiesTableProps, 'search' | 'columnVisibility'>) {
  const table = useFacilitiesTable({
    data: NO_FACILITIES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });

  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function FacilitiesTable({
  search,
  onSearchChange,
  columnVisibility,
  onAdd,
}: FacilitiesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(facilitiesListOptions(toFacilitiesQuery(deferredSearch)));
  const table = useFacilitiesTable({
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

  return (
    <DataTable
      empty={!isPastLastPage && empty}
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
