import { useSuspenseQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { CalendarDaysIcon, PencilIcon, PlusIcon } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { schedulesListOptions } from '@/features/processing-schedules/api/queries';
import {
  DEFAULT_SCHEDULES_SORT,
  type SchedulesSearch,
  toSchedulesQuery,
} from '@/features/processing-schedules/lib/search';
import type { ProcessingSchedule } from '@/features/reference-data/lib/types';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, ProcessingSchedule>();

function createColumns(t: TFunction, onEdit: (id: string) => void) {
  return columnHelper.columns([
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('processing-schedules.code')} />
      ),
      cell: ({ getValue }) => (
        <CellText dir="ltr" strong>
          {getValue()}
        </CellText>
      ),
      meta: { className: 'w-60 @xl/main:w-1/2' },
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('processing-schedules.name')} />
      ),
      cell: ({ getValue }) => <CellText>{getValue()}</CellText>,
      meta: { className: 'w-60 @xl/main:w-auto', label: t('processing-schedules.name') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('processing-schedules.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <ScheduleActions schedule={row.original} onEdit={onEdit} />,
    }),
  ]);
}

function ScheduleActions({
  schedule,
  onEdit,
}: {
  schedule: ProcessingSchedule;
  onEdit: (id: string) => void;
}) {
  const { t } = useTranslation();

  const label = t('processing-schedules.actions-for', { schedule: schedule.name });

  return (
    <RowActions
      label={label}
      actions={[
        {
          id: 'edit',
          icon: <PencilIcon />,
          label: t('processing-schedules.edit'),
          onSelect: () => onEdit(schedule.id),
        },
      ]}
    />
  );
}

type SchedulesTableProps = {
  cards: boolean;
  search: SchedulesSearch;
  onSearchChange: SearchChange<SchedulesSearch>;
  onAdd: () => void;
  onEdit: (id: string) => void;
};

const NO_SCHEDULES: ProcessingSchedule[] = [];

const getRowId = (schedule: ProcessingSchedule) => schedule.id;

const noop = () => {};

function useSchedulesTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  onEdit,
}: Omit<SchedulesTableProps, 'onAdd'> & { data: ProcessingSchedule[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, onEdit), [t, onEdit]);
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: DEFAULT_SCHEDULES_SORT,
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
    enableSortingRemoval: false,
    ...searchState,
  });
  return { table, pageStart };
}

export function SchedulesTableSkeleton({
  cards,
  search,
}: Pick<SchedulesTableProps, 'cards' | 'search'>) {
  const { table } = useSchedulesTable({
    cards: false,
    data: NO_SCHEDULES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    onEdit: noop,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="code" />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function SchedulesTable({
  cards,
  search,
  onSearchChange,
  onAdd,
  onEdit,
}: SchedulesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(schedulesListOptions(toSchedulesQuery(deferredSearch)));
  const { table, pageStart } = useSchedulesTable({
    cards,
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    onEdit,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
    }
  }, [isPastLastPage, data.totalPages, onSearchChange]);

  const empty = !isPastLastPage && (
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
  );
  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferredSearch;
  if (cards) {
    return (
      <TableCards
        busy={isStale}
        empty={empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="code"
      />
    );
  }
  return <DataTable empty={empty} footer={footer} isStale={isStale} table={table} />;
}
