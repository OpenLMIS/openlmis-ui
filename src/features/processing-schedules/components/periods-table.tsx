import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { CalendarRangeIcon, CheckIcon, InfoIcon, PlusIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { formatDateValue } from '@/components/form/date-value';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { periodsListOptions } from '@/features/processing-schedules/api/queries';
import { isReportOnly } from '@/features/processing-schedules/lib/period-form';
import {
  DEFAULT_PERIODS_SORT,
  type PeriodsSearch,
  toPeriodsQuery,
} from '@/features/processing-schedules/lib/search';
import type { ProcessingPeriod } from '@/features/processing-schedules/lib/types';
import { tableValue } from '@/lib/empty-value';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, ProcessingPeriod>();

function createColumns(t: TFunction, language: string) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('processing-schedules.periods.name')} />
      ),
      cell: ({ getValue }) => <span dir="auto">{getValue()}</span>,
      enableSorting: false,
      meta: { className: 'w-40 @xl/main:w-1/4' },
    }),
    columnHelper.accessor('description', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('processing-schedules.description')} />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-normal break-words" dir="auto">
          {tableValue(getValue())}
        </span>
      ),
      enableSorting: false,
      meta: { className: 'w-56 @xl/main:w-1/4' },
    }),
    columnHelper.accessor('startDate', {
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <DataTableColumnHeader
            column={column}
            title={t('processing-schedules.periods.start-date')}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t('processing-schedules.periods.start-hint')}
                  size="icon-xs"
                  variant="ghost"
                />
              }
            >
              <InfoIcon />
            </TooltipTrigger>
            <TooltipContent>{t('processing-schedules.periods.start-hint')}</TooltipContent>
          </Tooltip>
        </div>
      ),
      cell: ({ getValue }) => <bdi>{formatDateValue(getValue(), language)}</bdi>,
      meta: { className: 'w-44 @2xl/main:w-1/5' },
    }),
    columnHelper.accessor('endDate', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('processing-schedules.periods.end-date')} />
      ),
      cell: ({ getValue }) => <bdi>{formatDateValue(getValue(), language)}</bdi>,
      meta: { className: 'w-40 @2xl/main:w-1/5' },
    }),
    columnHelper.display({
      id: 'reportOnly',
      header: () => (
        <div className="flex justify-center">
          <DataTableHeaderLabel>
            {t('processing-schedules.periods.report-only')}
          </DataTableHeaderLabel>
        </div>
      ),
      cell: ({ row }) =>
        isReportOnly(row.original.extraData) ? (
          <span
            className="flex justify-center"
            role="img"
            aria-label={t('processing-schedules.periods.report-only')}
          >
            <CheckIcon aria-hidden="true" className="size-4" />
          </span>
        ) : null,
      meta: { className: 'w-32 @2xl/main:w-36' },
    }),
  ]);
}

type PeriodsTableProps = {
  scheduleId: string;
  scheduleCode: string;
  search: PeriodsSearch;
  onSearchChange: SearchChange<PeriodsSearch>;
  columnVisibility: ColumnVisibilityState;
  onAdd: () => void;
};

const NO_PERIODS: ProcessingPeriod[] = [];

const getRowId = (period: ProcessingPeriod) => period.id;

const noop = () => {};

function usePeriodsTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: Omit<PeriodsTableProps, 'onAdd' | 'scheduleId' | 'scheduleCode'> & {
  data: ProcessingPeriod[];
  rowCount: number;
}) {
  const { t, i18n } = useTranslation();
  const columns = useMemo(() => createColumns(t, i18n.language), [t, i18n.language]);
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_PERIODS_SORT,
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

export function PeriodsTableSkeleton({
  search,
  columnVisibility,
}: Pick<PeriodsTableProps, 'search' | 'columnVisibility'>) {
  const table = usePeriodsTable({
    data: NO_PERIODS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function PeriodsTable({
  scheduleId,
  scheduleCode,
  search,
  onSearchChange,
  columnVisibility,
  onAdd,
}: PeriodsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(periodsListOptions(toPeriodsQuery(scheduleId, deferredSearch)));
  const table = usePeriodsTable({
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

  return (
    <DataTable
      empty={
        !isPastLastPage && (
          <DataTableEmpty
            action={
              <Button onClick={onAdd}>
                <PlusIcon data-icon="inline-start" />
                {t('processing-schedules.periods.add')}
              </Button>
            }
            description={t('processing-schedules.periods.empty-description', {
              code: scheduleCode,
            })}
            icon={<CalendarRangeIcon />}
            title={t('processing-schedules.periods.empty-title')}
          />
        )
      }
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
