import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import {
  AlertCircleIcon,
  EyeIcon,
  MapPinIcon,
  PencilIcon,
  SearchXIcon,
  UsersIcon,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RowActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, GeographicZone>();

type ZoneActions = {
  onDetail: (id: string) => void;
  onPopulation: (id: string) => void;
};

function text(value: string | null | undefined) {
  return value ? <CellText>{value}</CellText> : null;
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
      cell: ({ getValue }) => <CellText strong>{getValue()}</CellText>,
      meta: { className: '@xl/main:w-1/4' },
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('geographic-zones.code')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      meta: { className: 'w-40 @xl/main:w-48', label: t('geographic-zones.code') },
    }),
    columnHelper.accessor('catchmentPopulation', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('geographic-zones.population')} />
      ),
      cell: ({ getValue }) => {
        const value = getValue();
        return value == null ? null : <span className="tabular-nums">{number.format(value)}</span>;
      },
      meta: { className: 'w-48', label: t('geographic-zones.population') },
    }),
    columnHelper.accessor((zone) => zone.level.name, {
      id: 'level',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('geographic-zones.level')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      meta: { className: '@2xl/main:w-32', label: t('geographic-zones.level') },
    }),
    columnHelper.accessor((zone) => zone.parent?.name, {
      id: 'parent',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('geographic-zones.parent')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      meta: { className: '@4xl/main:w-1/5', label: t('geographic-zones.parent') },
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
  if (!policy) return null;
  const label = t('geographic-zones.actions-for', { zone: zone.name });
  return (
    <RowActions
      label={label}
      actions={[
        {
          id: 'detail',
          icon: policy.editable ? <PencilIcon /> : <EyeIcon />,
          label: t(policy.editable ? 'geographic-zones.edit' : 'geographic-zones.view'),
          onSelect: () => actions.onDetail(zone.id),
        },
        ...(policy.visualizable
          ? [
              {
                id: 'population',
                icon: <UsersIcon />,
                label: t('geographic-zones.visualize'),
                onSelect: () => actions.onPopulation(zone.id),
              },
            ]
          : []),
      ]}
    />
  );
}

type GeographicZonesTableProps = ZoneActions & {
  cards: boolean;
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
  cards,
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
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: DEFAULT_GEOGRAPHIC_ZONES_SORT,
    onSearchChange,
    cards,
  });
  const table = useTable({
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
  return { table, pageStart };
}

export function GeographicZonesTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<GeographicZonesTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useGeographicZonesTable({
    cards: false,
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
  const rowCount = toPaginationState(search).pageSize;
  if (cards)
    return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" actions={2} />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function GeographicZonesTable(props: GeographicZonesTableProps) {
  const { cards, search, onSearchChange, automatic } = props;
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(
    geographicZonesListOptions(toGeographicZonesQuery(deferredSearch)),
  );
  const { data: levels } = useSuspenseQuery(geographicLevelsOptions());
  const { table, pageStart } = useGeographicZonesTable({
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

  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferredSearch;
  return (
    <>
      {invalidConfiguration && (
        <Alert variant="warning">
          <AlertCircleIcon />
          <AlertTitle>{t('geographic-zones.configuration-title')}</AlertTitle>
          <AlertDescription>{t('geographic-zones.configuration-description')}</AlertDescription>
        </Alert>
      )}
      {cards ? (
        <TableCards
          busy={isStale}
          empty={!isPastLastPage && empty}
          footer={footer}
          listRef={pageStart.ref}
          table={table}
          title="name"
        />
      ) : (
        <DataTable
          empty={!isPastLastPage && empty}
          footer={footer}
          isStale={isStale}
          table={table}
        />
      )}
    </>
  );
}
