import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { HistoryIcon, SearchXIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { formatTimestamp } from '@/components/form/date-value';
import { Button } from '@/components/ui/button';
import { stockEventsOptions } from '@/features/stock-events/api/queries';
import { eventTypeKey } from '@/features/stock-events/lib/event-list';
import {
  CLEARED_EVENT_FILTERS,
  hasEventFilters,
  type TransactionHistorySearch,
  toEventsQuery,
} from '@/features/stock-events/lib/search';
import type { StockEventSummary } from '@/features/stock-events/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { orEmpty } from '@/lib/empty-value';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const NO_SORT = { id: 'date', desc: true };
const columnHelper = createColumnHelper<DataTableFeatures, StockEventSummary>();
const getRowId = (event: StockEventSummary) => event.id;
const NO_EVENTS: StockEventSummary[] = [];
const noop = () => {};

const COLUMNS = [
  ['documentNumber', 'transaction-history.document-number'],
  ['type', 'transaction-history.type'],
  ['date', 'transaction-history.date'],
  ['entriesCount', 'transaction-history.entries-count'],
  ['performedBy', 'transaction-history.performed-by'],
  ['signature', 'transaction-history.signature'],
] as const;

export const EVENT_HIDEABLE_COLUMNS = [
  { id: 'type', labelKey: 'transaction-history.type', hideBelow: 440 },
  { id: 'date', labelKey: 'transaction-history.date', hideBelow: 320 },
  { id: 'entriesCount', labelKey: 'transaction-history.entries-count', hideBelow: 640 },
  { id: 'performedBy', labelKey: 'transaction-history.performed-by', hideBelow: 768 },
  { id: 'signature', labelKey: 'transaction-history.signature', hideBelow: 896 },
] as const;

type CellId = (typeof COLUMNS)[number][0];

function Wrapped({ children }: { children: string | number | null | undefined }) {
  return (
    <span className="block max-w-60 whitespace-normal break-normal">
      <bdi>{orEmpty(children)}</bdi>
    </span>
  );
}

type EventDay = (value: string | null | undefined) => string;

function useEventDay(timeZone: string | undefined): EventDay {
  const { i18n } = useTranslation();
  return useCallback(
    (value) => formatTimestamp(value, i18n.language, { timeZone }),
    [i18n.language, timeZone],
  );
}

function EventCell({
  id,
  event,
  eventDay,
}: {
  id: CellId;
  event: StockEventSummary;
  eventDay: EventDay;
}) {
  const { t, i18n } = useTranslation();
  switch (id) {
    case 'documentNumber':
      return (
        <span className="whitespace-nowrap">
          <bdi>{orEmpty(event.documentNumber)}</bdi>
        </span>
      );
    case 'type': {
      const key = eventTypeKey(event.type);
      return <Wrapped>{key && t(key)}</Wrapped>;
    }
    case 'date':
      return (
        <span className="whitespace-nowrap">
          <bdi>{orEmpty(eventDay(event.processedDate))}</bdi>
        </span>
      );
    case 'entriesCount':
      return (
        <span className="tabular-nums">
          {orEmpty(event.entriesCount?.toLocaleString(i18n.language))}
        </span>
      );
    case 'performedBy':
      return <Wrapped>{event.username}</Wrapped>;
    case 'signature':
      return <Wrapped>{event.signature}</Wrapped>;
  }
}

function ViewEvent({
  event,
  search,
  eventDay,
}: {
  event: StockEventSummary;
  search: TransactionHistorySearch;
  eventDay: EventDay;
}) {
  const { t } = useTranslation();
  const document = event.documentNumber || eventDay(event.processedDate);
  return (
    <Button
      aria-label={t('transaction-history.view-event', { document })}
      nativeButton={false}
      render={
        <Link
          params={{ eventId: event.id }}
          search={search}
          to="/stock-management/transaction-history/$eventId"
        />
      }
      size="sm"
    >
      {t('transaction-history.view')}
    </Button>
  );
}

function useEventColumns(search: TransactionHistorySearch, eventDay: EventDay) {
  const { t } = useTranslation();
  return useMemo(
    () =>
      columnHelper.columns([
        ...COLUMNS.map(([id, key]) =>
          columnHelper.display({
            id,
            header: () => <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>,
            cell: ({ row }) => <EventCell event={row.original} eventDay={eventDay} id={id} />,
          }),
        ),
        columnHelper.display({
          id: 'actions',
          header: () => (
            <DataTableHeaderLabel>{t('transaction-history.actions')}</DataTableHeaderLabel>
          ),
          cell: ({ row }) => <ViewEvent event={row.original} eventDay={eventDay} search={search} />,
        }),
      ]),
    [t, search, eventDay],
  );
}

type ResultsProps = {
  search: TransactionHistorySearch;
  facilityId: string;
  programId: string;
  columns: ColumnVisibilityState;
  onSearchChange: SearchChange<TransactionHistorySearch>;
};

function useEventsTable({
  data,
  rowCount,
  search,
  columns,
  onSearchChange,
  timeZone,
}: Pick<ResultsProps, 'search' | 'columns' | 'onSearchChange'> & {
  data: StockEventSummary[];
  rowCount: number;
  timeZone?: string;
}) {
  const columnDefs = useEventColumns(search, useEventDay(timeZone));
  const searchState = useTableSearchState({ search, defaultSort: NO_SORT, onSearchChange });
  return useTable({
    features: dataTableFeatures,
    columns: columnDefs,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility: columns },
  });
}

export function TransactionHistoryResults({
  search,
  facilityId,
  programId,
  columns,
  onSearchChange,
}: ResultsProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data: page } = useSuspenseQuery(
    stockEventsOptions(toEventsQuery(deferredSearch, { facilityId, programId })),
  );
  const table = useEventsTable({
    data: page.content,
    rowCount: page.totalElements,
    search: deferredSearch,
    columns,
    onSearchChange,
    timeZone: useDeploymentTimeZone(),
  });
  const isPastLastPage = page.content.length === 0 && page.totalElements > 0;

  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: page.totalPages > 1 ? page.totalPages : undefined }, true);
    }
  }, [isPastLastPage, page.totalPages, onSearchChange]);

  const empty = hasEventFilters(deferredSearch) ? (
    <DataTableEmpty
      action={
        <Button onClick={() => onSearchChange(CLEARED_EVENT_FILTERS)} variant="destructive">
          {t('transaction-history.clear-filters')}
        </Button>
      }
      description={t('transaction-history.no-matches-description')}
      icon={<SearchXIcon />}
      title={t('transaction-history.no-matches-title')}
    />
  ) : (
    <DataTableEmpty
      description={t('transaction-history.no-events-description')}
      icon={<HistoryIcon />}
      title={t('transaction-history.no-events-title')}
    />
  );

  return (
    <DataTable
      density="default"
      empty={!isPastLastPage && empty}
      footer={!isPastLastPage && page.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      layout="auto"
      table={table}
    />
  );
}

export function TransactionHistoryResultsSkeleton({
  search,
  columns,
}: Pick<ResultsProps, 'search' | 'columns'>) {
  const table = useEventsTable({
    data: NO_EVENTS,
    rowCount: 0,
    search,
    columns,
    onSearchChange: noop,
  });
  return (
    <DataTableSkeleton
      density="default"
      layout="auto"
      rowCount={toPaginationState(search).pageSize}
      table={table}
    />
  );
}
