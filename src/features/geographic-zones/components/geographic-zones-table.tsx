import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import {
  AlertCircleIcon,
  EllipsisIcon,
  EyeIcon,
  MapPinIcon,
  PencilIcon,
  SearchXIcon,
  UsersIcon,
} from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { geographicZonesListOptions } from '@/features/geographic-zones/api/queries';
import {
  CLEARED_GEOGRAPHIC_ZONE_FILTERS,
  DEFAULT_GEOGRAPHIC_ZONES_SORT,
  type GeographicZonesSearch,
  hasGeographicZoneFilters,
  toGeographicZonesQuery,
} from '@/features/geographic-zones/lib/search';
import { geographicZonePolicy } from '@/features/geographic-zones/lib/zone-form';
import { geographicLevelsOptions } from '@/features/reference-data/api/queries';
import type { GeographicLevel, GeographicZone } from '@/features/reference-data/lib/types';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, GeographicZone>();

type ZoneActions = {
  onDetail: (id: string) => void;
  onPopulation: (id: string) => void;
};

function text(value: string | null | undefined) {
  return value ? (
    <span className="flex">
      <span className="min-w-0 truncate" dir="auto">
        {value}
      </span>
    </span>
  ) : null;
}

function createColumns(
  t: TFunction,
  language: string,
  levels: readonly GeographicLevel[],
  automatic: boolean,
  actions: ZoneActions,
) {
  const number = new Intl.NumberFormat(language);
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('geographic-zones.name')} />
      ),
      cell: ({ getValue }) => (
        <span className="flex">
          <span className="min-w-0 truncate font-medium" dir="auto">
            {getValue()}
          </span>
        </span>
      ),
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('geographic-zones.code')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      meta: { className: 'w-28 @xl/main:w-36' },
    }),
    columnHelper.accessor('catchmentPopulation', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('geographic-zones.population')} />
      ),
      cell: ({ getValue }) => {
        const value = getValue();
        return value == null ? null : <span className="tabular-nums">{number.format(value)}</span>;
      },
      meta: { className: 'w-48' },
    }),
    columnHelper.accessor((zone) => zone.level.name, {
      id: 'level',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('geographic-zones.level')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      meta: { className: '@2xl/main:w-32' },
    }),
    columnHelper.accessor((zone) => zone.parent?.name, {
      id: 'parent',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('geographic-zones.parent')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      meta: { className: '@4xl/main:w-1/5' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('geographic-zones.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => (
        <GeographicZoneActions
          actions={actions}
          policy={geographicZonePolicy(row.original, levels, automatic)}
          zone={row.original}
        />
      ),
    }),
  ]);
}

function GeographicZoneActions({
  zone,
  policy,
  actions,
}: {
  zone: GeographicZone;
  policy: ReturnType<typeof geographicZonePolicy>;
  actions: ZoneActions;
}) {
  const { t } = useTranslation();
  const menu = useMenuOpensDialog();
  if (!policy) return null;
  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('geographic-zones.actions-for', { zone: zone.name })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" finalFocus={menu.finalFocus} width="auto">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={menu.opensDialog(() => actions.onDetail(zone.id))}>
              {policy.editable ? <PencilIcon /> : <EyeIcon />}
              {t(policy.editable ? 'geographic-zones.edit' : 'geographic-zones.view')}
            </DropdownMenuItem>
            {policy.visualizable && (
              <DropdownMenuItem onClick={menu.opensDialog(() => actions.onPopulation(zone.id))}>
                <UsersIcon />
                {t('geographic-zones.visualize')}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type GeographicZonesTableProps = ZoneActions & {
  search: GeographicZonesSearch;
  onSearchChange: SearchChange<GeographicZonesSearch>;
  columnVisibility: ColumnVisibilityState;
  automatic: boolean;
};

const NO_ZONES: GeographicZone[] = [];
const NO_LEVELS: GeographicLevel[] = [];
const noop = () => {};
const getRowId = (zone: GeographicZone) => zone.id;

function useGeographicZonesTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
  automatic,
  levels,
  onDetail,
  onPopulation,
}: GeographicZonesTableProps & {
  data: GeographicZone[];
  rowCount: number;
  levels: GeographicLevel[];
}) {
  const { t, i18n } = useTranslation();
  const columns = useMemo(
    () => createColumns(t, i18n.language, levels, automatic, { onDetail, onPopulation }),
    [t, i18n.language, levels, automatic, onDetail, onPopulation],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_GEOGRAPHIC_ZONES_SORT,
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
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
}

export function GeographicZonesTableSkeleton({
  search,
  columnVisibility,
}: Pick<GeographicZonesTableProps, 'search' | 'columnVisibility'>) {
  const table = useGeographicZonesTable({
    data: NO_ZONES,
    rowCount: 0,
    search,
    columnVisibility,
    automatic: false,
    levels: NO_LEVELS,
    onSearchChange: noop,
    onDetail: noop,
    onPopulation: noop,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function GeographicZonesTable(props: GeographicZonesTableProps) {
  const { search, onSearchChange, automatic } = props;
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(
    geographicZonesListOptions(toGeographicZonesQuery(deferredSearch)),
  );
  const { data: levels } = useSuspenseQuery(geographicLevelsOptions());
  const table = useGeographicZonesTable({
    ...props,
    search: deferredSearch,
    data: data.content,
    rowCount: data.totalElements,
    levels,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;
  const invalidConfiguration =
    !levels.some((level) => geographicZonePolicy({ level }, levels, automatic)) ||
    data.content.some((zone) => !geographicZonePolicy(zone, levels, automatic));

  useEffect(() => {
    if (isPastLastPage)
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
  }, [isPastLastPage, data.totalPages, onSearchChange]);

  const empty = hasGeographicZoneFilters(deferredSearch) ? (
    <DataTableEmpty
      action={
        <Button
          onClick={() => onSearchChange(CLEARED_GEOGRAPHIC_ZONE_FILTERS)}
          variant="destructive"
        >
          {t('geographic-zones.clear-filters')}
        </Button>
      }
      description={t('geographic-zones.no-results-description')}
      icon={<SearchXIcon />}
      title={t('geographic-zones.no-results-title')}
    />
  ) : (
    <DataTableEmpty
      description={t('geographic-zones.empty-description')}
      icon={<MapPinIcon />}
      title={t('geographic-zones.empty-title')}
    />
  );

  return (
    <>
      {invalidConfiguration && (
        <Alert variant="warning">
          <AlertCircleIcon />
          <AlertTitle>{t('geographic-zones.configuration-title')}</AlertTitle>
          <AlertDescription>{t('geographic-zones.configuration-description')}</AlertDescription>
        </Alert>
      )}
      <DataTable
        empty={!isPastLastPage && empty}
        footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
        isStale={search !== deferredSearch}
        table={table}
      />
    </>
  );
}
