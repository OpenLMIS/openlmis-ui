import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { HistoryIcon, SearchXIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CardBand,
  CardList,
  CardListItem,
  CardRowSkeleton,
  CardRows,
  SkeletonBar,
} from '@/components/card-list';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import {
  DataTablePagination,
  DataTablePaginationSkeleton,
} from '@/components/data-table/data-table-pagination';
import { formatTimestamp } from '@/components/form/date-value';
import { SettingsItem } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { stockEventsOptions } from '@/features/stock-events/api/queries';
import { eventTypeKey } from '@/features/stock-events/lib/event-list';
import {
  CLEARED_EVENT_FILTERS,
  EVENTS_PAGE_SIZE,
  hasEventFilters,
  type TransactionHistorySearch,
  toEventsQuery,
} from '@/features/stock-events/lib/search';
import type { StockEventSummary } from '@/features/stock-events/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePageStart } from '@/hooks/use-page-start';
import { EMPTY_VALUE, tableValue } from '@/lib/empty-value';
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
  { id: 'type', labelKey: 'transaction-history.type' },
  { id: 'date', labelKey: 'transaction-history.date' },
  { id: 'entriesCount', labelKey: 'transaction-history.entries-count' },
  { id: 'performedBy', labelKey: 'transaction-history.performed-by', hideBelow: 768 },
  { id: 'signature', labelKey: 'transaction-history.signature', hideBelow: 896 },
] as const;

type CellId = (typeof COLUMNS)[number][0];
const CARD_ROWS = COLUMNS.filter(([id]) => id !== 'documentNumber');

function Wrapped({
  children,
  empty,
}: {
  children: string | number | null | undefined;
  empty?: string;
}) {
  return (
    <span className="block max-w-60 whitespace-normal break-normal">
      <bdi>{tableValue(children) ?? empty}</bdi>
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
  empty,
}: {
  id: CellId;
  event: StockEventSummary;
  eventDay: EventDay;
  empty?: string;
}) {
  const { t, i18n } = useTranslation();
  switch (id) {
    case 'documentNumber':
      return (
        <span className="whitespace-nowrap">
          <bdi>{tableValue(event.documentNumber) ?? empty}</bdi>
        </span>
      );
    case 'type': {
      const key = eventTypeKey(event.type);
      return <Wrapped empty={empty}>{key && t(key)}</Wrapped>;
    }
    case 'date':
      return (
        <span className="whitespace-nowrap">
          <bdi>{tableValue(eventDay(event.processedDate)) ?? empty}</bdi>
        </span>
      );
    case 'entriesCount':
      return (
        <span className="tabular-nums">
          <bdi>{tableValue(event.entriesCount?.toLocaleString(i18n.language)) ?? empty}</bdi>
        </span>
      );
    case 'performedBy':
      return <Wrapped empty={empty}>{event.username}</Wrapped>;
    case 'signature':
      return <Wrapped empty={empty}>{event.signature}</Wrapped>;
  }
}

function ViewEvent({
  event,
  search,
  eventDay,
  disabled,
}: {
  event: StockEventSummary;
  search: TransactionHistorySearch;
  disabled: boolean;
  eventDay: EventDay;
}) {
  const { t } = useTranslation();
  const document = event.documentNumber || eventDay(event.processedDate);
  return (
    <Button
      aria-label={t('transaction-history.view-event', { document })}
      disabled={disabled}
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

function useEventColumns(search: TransactionHistorySearch, eventDay: EventDay, stale: boolean) {
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
          cell: ({ row }) => (
            <ViewEvent disabled={stale} event={row.original} eventDay={eventDay} search={search} />
          ),
        }),
      ]),
    [t, search, eventDay, stale],
  );
}

function EventCard({
  event,
  search,
  columns,
  eventDay,
  stale,
}: {
  event: StockEventSummary;
  search: TransactionHistorySearch;
  columns: ColumnVisibilityState;
  eventDay: EventDay;
  stale: boolean;
}) {
  const { t } = useTranslation();
  return (
    <CardListItem>
      <CardBand>
        <div className="min-w-0 wrap-anywhere">
          <bdi>{event.documentNumber || eventDay(event.processedDate)}</bdi>
        </div>
        <ViewEvent disabled={stale} event={event} eventDay={eventDay} search={search} />
      </CardBand>
      <CardRows>
        {CARD_ROWS.filter(([id]) => columns[id] !== false).map(([id, key]) => (
          <SettingsItem key={id} label={t(key)}>
            <EventCell empty={EMPTY_VALUE} event={event} eventDay={eventDay} id={id} />
          </SettingsItem>
        ))}
      </CardRows>
    </CardListItem>
  );
}

type ResultsProps = {
  cards: boolean;
  search: TransactionHistorySearch;
  facilityId: string;
  programId: string;
  columns: ColumnVisibilityState;
  onSearchChange: SearchChange<TransactionHistorySearch>;
};

function useEventsTable({
  cards,
  data,
  rowCount,
  search,
  columns,
  onSearchChange,
  eventDay,
  stale,
}: Pick<ResultsProps, 'cards' | 'search' | 'columns' | 'onSearchChange'> & {
  data: StockEventSummary[];
  rowCount: number;
  eventDay: EventDay;
  stale: boolean;
}) {
  const columnDefs = useEventColumns(search, eventDay, stale);
  const onPageChange = useCallback<SearchChange<TransactionHistorySearch>>(
    (update) => onSearchChange(update, false, cards ? { resetScroll: false } : undefined),
    [onSearchChange, cards],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: NO_SORT,
    defaultPageSize: EVENTS_PAGE_SIZE,
    onSearchChange: onPageChange,
  });
  const { pageIndex, pageSize } = searchState.state.pagination;
  const pageStart = usePageStart<HTMLUListElement>(`${pageIndex}:${pageSize}`);
  const table = useTable({
    features: dataTableFeatures,
    columns: columnDefs,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
    onPaginationChange: (updater) => {
      if (cards) pageStart.request();
      searchState.onPaginationChange(updater);
    },
    state: { ...searchState.state, columnVisibility: columns },
  });
  return { table, pageStart };
}

export function TransactionHistoryResults({
  cards,
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
  const eventDay = useEventDay(useDeploymentTimeZone());
  const isStale = search !== deferredSearch;
  const { table, pageStart } = useEventsTable({
    cards,
    data: page.content,
    rowCount: page.totalElements,
    search: deferredSearch,
    columns,
    onSearchChange,
    eventDay,
    stale: isStale,
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

  const footer = !isPastLastPage && page.totalElements > 0 && <DataTablePagination table={table} />;
  if (cards) {
    return (
      <CardList
        busy={isStale}
        empty={page.totalElements === 0 && empty}
        footer={footer}
        listRef={pageStart.ref}
      >
        {page.content.map((event) => (
          <EventCard
            stale={isStale}
            columns={columns}
            event={event}
            eventDay={eventDay}
            key={event.id}
            search={deferredSearch}
          />
        ))}
      </CardList>
    );
  }
  return (
    <DataTable
      density="default"
      empty={!isPastLastPage && empty}
      footer={footer}
      isStale={isStale}
      layout="auto"
      table={table}
    />
  );
}

const SKELETON_CARDS = ['a', 'b', 'c'];

export function TransactionHistoryResultsSkeleton({
  cards,
  search,
  columns,
}: Pick<ResultsProps, 'cards' | 'search' | 'columns'>) {
  const { table } = useEventsTable({
    cards: false,
    eventDay: useEventDay(undefined),
    data: NO_EVENTS,
    rowCount: 0,
    search,
    columns,
    onSearchChange: noop,
    stale: false,
  });
  const rowCount = toPaginationState(search, EVENTS_PAGE_SIZE).pageSize;
  if (cards) {
    return (
      <CardList footer={<DataTablePaginationSkeleton />}>
        {SKELETON_CARDS.slice(0, rowCount).map((id) => (
          <CardListItem key={id}>
            <CardBand>
              <SkeletonBar width="w-24" />
              <div className="h-7 w-16">
                <Skeleton fill />
              </div>
            </CardBand>
            <CardRows>
              {CARD_ROWS.filter(([column]) => columns[column] !== false).map(([column]) => (
                <CardRowSkeleton key={column} />
              ))}
            </CardRows>
          </CardListItem>
        ))}
      </CardList>
    );
  }
  return <DataTableSkeleton density="default" layout="auto" rowCount={rowCount} table={table} />;
}
