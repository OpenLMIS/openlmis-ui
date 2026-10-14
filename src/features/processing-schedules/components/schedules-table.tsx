import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { CalendarDaysIcon, EllipsisIcon, PencilIcon, PlusIcon } from 'lucide-react';
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
import { schedulesListOptions } from '@/features/processing-schedules/api/queries';
import {
  DEFAULT_SCHEDULES_SORT,
  type SchedulesSearch,
  toScheduleListParams,
  toSchedulesQuery,
} from '@/features/processing-schedules/lib/search';
import type { ProcessingSchedule } from '@/features/reference-data/lib/types';
import { tableValue } from '@/lib/empty-value';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, ProcessingSchedule>();

function createColumns(t: TFunction, search: SchedulesSearch) {
  return columnHelper.columns([
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('processing-schedules.code')} />
      ),
      cell: ({ getValue }) => (
        <span className="flex">
          <span className="min-w-0 truncate font-medium" dir="ltr">
            {getValue()}
          </span>
        </span>
      ),
      meta: { className: '@xl/main:w-1/3' },
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('processing-schedules.name')} />
      ),
      cell: ({ getValue }) => (
        <span className="flex">
          <span className="min-w-0 truncate" dir="auto">
            {getValue()}
          </span>
        </span>
      ),
    }),
    columnHelper.accessor('description', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('processing-schedules.description')} />
      ),
      cell: ({ getValue }) => <span dir="auto">{tableValue(getValue())}</span>,
      enableSorting: false,
      meta: { className: '@xl/main:w-1/3' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('processing-schedules.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <ScheduleActions schedule={row.original} search={search} />,
    }),
  ]);
}

function ScheduleActions({
  schedule,
  search,
}: {
  schedule: ProcessingSchedule;
  search: SchedulesSearch;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('processing-schedules.actions-for', { schedule: schedule.name })}
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
                  to="/administration/processing-schedules/$id"
                  params={{ id: schedule.id }}
                  search={toScheduleListParams(search)}
                />
              }
            >
              <PencilIcon />
              {t('processing-schedules.edit')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type SchedulesTableProps = {
  search: SchedulesSearch;
  onSearchChange: SearchChange<SchedulesSearch>;
  columnVisibility: ColumnVisibilityState;
  onAdd: () => void;
};

const NO_SCHEDULES: ProcessingSchedule[] = [];

const getRowId = (schedule: ProcessingSchedule) => schedule.id;

const noop = () => {};

function useSchedulesTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: Omit<SchedulesTableProps, 'onAdd'> & { data: ProcessingSchedule[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, search), [t, search]);
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_SCHEDULES_SORT,
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

export function SchedulesTableSkeleton({
  search,
  columnVisibility,
}: Pick<SchedulesTableProps, 'search' | 'columnVisibility'>) {
  const table = useSchedulesTable({
    data: NO_SCHEDULES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function SchedulesTable({
  search,
  onSearchChange,
  columnVisibility,
  onAdd,
}: SchedulesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(schedulesListOptions(toSchedulesQuery(deferredSearch)));
  const table = useSchedulesTable({
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
                {t('processing-schedules.add')}
              </Button>
            }
            description={t('processing-schedules.empty-description')}
            icon={<CalendarDaysIcon />}
            title={t('processing-schedules.empty-title')}
          />
        )
      }
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
