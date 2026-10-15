import { useSuspenseQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  functionalUpdate,
  type PaginationState,
  type Updater,
  useTable,
} from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { CalendarRangeIcon, InfoIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
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
import { FlagBadge } from '@/components/flag-badge';
import { formatDateValue } from '@/components/form/date-value';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { periodsListOptions } from '@/features/processing-schedules/api/queries';
import { isReportOnly } from '@/features/processing-schedules/lib/period-form';
import {
  PERIODS_PAGE_SIZE,
  type SchedulesSearch,
  toPeriodsQuery,
} from '@/features/processing-schedules/lib/search';
import type { ProcessingPeriod } from '@/features/processing-schedules/lib/types';
import { tableValue } from '@/lib/empty-value';
import { fromPaginationState, type SearchChange, toPaginationState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, ProcessingPeriod>();

function createColumns(t: TFunction, language: string) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('processing-schedules.periods.name')} />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-normal break-words" dir="auto">
          {getValue()}
        </span>
      ),
      enableSorting: false,
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
    }),
    columnHelper.accessor('endDate', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('processing-schedules.periods.end-date')} />
      ),
      cell: ({ getValue }) => <bdi>{formatDateValue(getValue(), language)}</bdi>,
    }),
    columnHelper.display({
      id: 'reportOnly',
      header: () => (
        <DataTableHeaderLabel>{t('processing-schedules.periods.report-only')}</DataTableHeaderLabel>
      ),
      cell: ({ row }) => (
        <FlagBadge
          value={isReportOnly(row.original.extraData)}
          trueLabel={t('processing-schedules.periods.yes')}
          falseLabel={t('processing-schedules.periods.no')}
        />
      ),
    }),
  ]);
}

type PeriodsTableProps = {
  scheduleId: string;
  scheduleCode: string;
  search: SchedulesSearch;
  onSearchChange: SearchChange<SchedulesSearch>;
};

const NO_PERIODS: ProcessingPeriod[] = [];

const getRowId = (period: ProcessingPeriod) => period.id;

const noop = () => {};

function usePeriodsTable({
  data,
  rowCount,
  search,
  onSearchChange,
}: Omit<PeriodsTableProps, 'scheduleId' | 'scheduleCode'> & {
  data: ProcessingPeriod[];
  rowCount: number;
}) {
  const { t, i18n } = useTranslation();
  const columns = useMemo(() => createColumns(t, i18n.language), [t, i18n.language]);
  const pagination = useMemo(
    () => toPaginationState({ page: search.periodsPage, size: PERIODS_PAGE_SIZE }),
    [search.periodsPage],
  );
  const onPaginationChange = useCallback<(updater: Updater<PaginationState>) => void>(
    (updater) =>
      onSearchChange(
        (previous) => {
          const current = toPaginationState({
            page: previous.periodsPage,
            size: PERIODS_PAGE_SIZE,
          });
          return {
            periodsPage: fromPaginationState(current, functionalUpdate(updater, current)).page,
          };
        },
        true,
        { keepState: true },
      ),
    [onSearchChange],
  );

  return useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    state: { pagination },
    onPaginationChange,
  });
}

export function PeriodsTableSkeleton({ search }: Pick<PeriodsTableProps, 'search'>) {
  const table = usePeriodsTable({
    data: NO_PERIODS,
    rowCount: 0,
    search,
    onSearchChange: noop,
  });
  return (
    <DataTableSkeleton
      density="compact"
      height="fill"
      layout="auto"
      pagination="centered"
      rowCount={PERIODS_PAGE_SIZE}
      table={table}
    />
  );
}

export function PeriodsTable({
  scheduleId,
  scheduleCode,
  search,
  onSearchChange,
}: PeriodsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(periodsListOptions(toPeriodsQuery(scheduleId, deferredSearch)));
  const table = usePeriodsTable({
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ periodsPage: data.totalPages > 1 ? data.totalPages : undefined }, true, {
        keepState: true,
      });
    }
  }, [isPastLastPage, data.totalPages, onSearchChange]);

  return (
    <DataTable
      density="compact"
      height="fill"
      empty={
        !isPastLastPage && (
          <DataTableEmpty
            description={t('processing-schedules.periods.empty-description', {
              code: scheduleCode,
            })}
            icon={<CalendarRangeIcon />}
            title={t('processing-schedules.periods.empty-title')}
          />
        )
      }
      footer={
        !isPastLastPage &&
        data.totalElements > 0 && <DataTablePagination layout="centered" table={table} />
      }
      isStale={search !== deferredSearch}
      layout="auto"
      table={table}
    />
  );
}
