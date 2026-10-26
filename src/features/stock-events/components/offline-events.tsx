import { type ColumnDef, useTable } from '@tanstack/react-table';
import { ListChecksIcon, ListIcon } from 'lucide-react';
import {
  createContext,
  use,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useInCards } from '@/components/card-actions';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { DialogNotFound } from '@/components/dialog-parts';
import { formatDateValue, formatTimestamp } from '@/components/form/date-value';
import { DatePicker } from '@/components/form/form-fields';
import { FormDialog } from '@/components/form-dialog/form-dialog';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import { TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { DeviceEventActions } from '@/features/stock-events/components/device-event-actions';
import { DeviceEventLines } from '@/features/stock-events/components/device-event-lines';
import { DeviceEventRecovery } from '@/features/stock-events/components/device-event-recovery';
import { removeKey } from '@/features/stock-events/components/device-event-removal';
import {
  OfflineEventErrorMessage,
  OfflineEventPendingState,
} from '@/features/stock-events/components/offline-event-state';
import { useOfflineEvents } from '@/features/stock-events/hooks/use-offline-events';
import { deviceEventDetails } from '@/features/stock-events/lib/device-event-details';
import { EVENT_KINDS, OFFLINE_EVENT_TYPES } from '@/features/stock-events/lib/event-kinds';
import { tabOf } from '@/features/stock-events/lib/offline-event-tabs';
import {
  activeEventFilters,
  CLEARED_EVENT_FILTERS,
  type OfflineEventsSearch,
  offlineEventTab,
} from '@/features/stock-events/lib/offline-events-search';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { blockedScopes } from '@/features/stock-events/lib/stock-event-sync';
import { useCardLayout } from '@/hooks/use-card-view';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePageStart } from '@/hooks/use-page-start';
import { useStoredState } from '@/hooks/use-stored-state';
import { tableValue } from '@/lib/empty-value';
import { recordLabel } from '@/lib/facility-program-selection';
import { hasProgramGrant, type Permissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import {
  type SearchChange,
  searchSort,
  toPaginationState,
  useTableSearchState,
} from '@/lib/table-search';

const tabs = ['pending', 'errors', 'synced'] as const;
const sharedHideable = [
  { id: 'facility', labelKey: 'facility-program.facility', hideBelow: '5xl' },
  { id: 'program', labelKey: 'facility-program.program', hideBelow: '4xl' },
  { id: 'details', labelKey: 'offline-events.line-details' },
] as const;
const hideableByTab = {
  pending: [...sharedHideable, { id: 'status', labelKey: 'offline-events.status' }],
  errors: [...sharedHideable, { id: 'failedAt', labelKey: 'offline-events.failed-at' }],
  synced: [...sharedHideable, { id: 'acceptedAt', labelKey: 'offline-events.synced-at' }],
} as const;
const defaultSortByTab = {
  pending: { id: 'queuedAt', desc: false, labelKey: 'offline-events.queued-at' },
  errors: { id: 'failedAt', desc: false, labelKey: 'offline-events.failed-at' },
  synced: { id: 'acceptedAt', desc: true, labelKey: 'offline-events.synced-at' },
} as const;
const emptyByTab = {
  pending: {
    title: 'offline-events.no-events-title',
    description: 'offline-events.no-events-description',
  },
  errors: {
    title: 'offline-events.no-errors-title',
    description: 'offline-events.no-errors-description',
  },
  synced: {
    title: 'offline-events.no-synced-title',
    description: 'offline-events.no-synced-description',
  },
} as const;

const EventCellsContext = createContext<{
  blocked: ReadonlySet<string>;
  canSend: (event: DeviceEvent) => boolean;
  reviewLabel: (
    event: DeviceEvent,
    key?:
      | 'offline-events.review-event-label'
      | 'offline-events.remove-event-label'
      | 'offline-events.dismiss-event-label'
      | 'offline-events.details-label',
  ) => string;
  onOpenEvent: (id: string) => void;
  onRemoved: (id: string) => void;
} | null>(null);

function PendingStateCell({ event }: { event: DeviceEvent }) {
  const context = use(EventCellsContext);
  return context && <OfflineEventPendingState event={event} blocked={context.blocked} />;
}

function DetailsCell({ event }: { event: DeviceEvent }) {
  const context = use(EventCellsContext);
  const inCards = useInCards();
  return (
    context && (
      <EventDetails
        event={event}
        label={context.reviewLabel(event, 'offline-events.details-label')}
        size={inCards ? undefined : 'sm'}
      />
    )
  );
}

function ActionsCell({ event }: { event: DeviceEvent }) {
  const context = use(EventCellsContext);
  return (
    context && (
      <DeviceEventActions
        event={event}
        canSend={context.canSend(event)}
        label={context.reviewLabel(event)}
        removeLabel={context.reviewLabel(event, `${removeKey(event)}-event-label`)}
        onOpen={() => context.onOpenEvent(event.localEventId)}
        onRemoved={() => context.onRemoved(event.localEventId)}
      />
    )
  );
}

const choicesSchema = z.record(z.string(), z.boolean());

const occurredDate = (event: DeviceEvent) =>
  [...new Set(event.payload.lineItems.map((line) => line.occurredDate).filter(Boolean))].sort();

const sortValue = {
  occurredDate: (event: DeviceEvent) => occurredDate(event).join(),
  queuedAt: (event: DeviceEvent) => event.queuedAt,
  failedAt: (event: DeviceEvent) => event.error?.failedAt ?? 0,
  acceptedAt: (event: DeviceEvent) => event.receipt?.acceptedAt ?? 0,
};

function EventDate({ event }: { event: DeviceEvent }) {
  const { i18n } = useTranslation();
  return occurredDate(event).map((date) => (
    <time className="block whitespace-nowrap" dateTime={date} key={date}>
      {formatDateValue(date, i18n.language)}
    </time>
  ));
}

function EventDetails({ event, label, size }: { event: DeviceEvent; label: string; size?: 'sm' }) {
  const { t } = useTranslation();
  const count = t('offline-events.details-count', { count: deviceEventDetails(event).length });
  return (
    <Popover>
      <PopoverTrigger render={<Button aria-label={label} size={size} variant="outline" />}>
        <ListIcon data-icon="inline-start" />
        {count}
      </PopoverTrigger>
      <PopoverContent align="end" width="table">
        <PopoverHeader>
          <PopoverTitle>{t(EVENT_KINDS[event.kind].copy.eventType)}</PopoverTitle>
          <PopoverDescription>{count}</PopoverDescription>
        </PopoverHeader>
        <ScrollArea height="fill">
          <DeviceEventLines event={event} />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function OfflineEventsPage({
  search,
  onSearchChange,
  onOpenEvent,
  onCloseEvent,
  permissions,
  permissionsUpdatedAt,
  refreshOfflineDownload,
}: {
  permissions: Permissions;
  permissionsUpdatedAt: number;
  refreshOfflineDownload?: (refreshKey: string) => void;
  search: OfflineEventsSearch;
  onSearchChange: SearchChange<OfflineEventsSearch>;
  onOpenEvent: (event: string) => void;
  onCloseEvent: () => void;
}) {
  const { t } = useTranslation();
  const panelId = useId();
  const tab = offlineEventTab(search);
  const hideable = hideableByTab[tab];
  const defaultSort = defaultSortByTab[tab];
  const { measure, cards, width } = useCardLayout<HTMLDivElement>();
  const pendingChoices = useStoredState('device-events.columns.pending', choicesSchema, {});
  const errorChoices = useStoredState('device-events.columns.errors', choicesSchema, {});
  const syncedChoices = useStoredState('device-events.columns.synced', choicesSchema, {});
  const choices = { pending: pendingChoices, errors: errorChoices, synced: syncedChoices };
  const view = useColumnVisibility(hideable, choices[tab], cards ? undefined : width);
  const layout = cards ? 'cards' : 'table';
  const local = useOfflineEvents();
  useEffect(() => {
    const allowed = ['occurredDate', defaultSort.id];
    const clearSort =
      search.sort &&
      (!allowed.includes(search.sort) ||
        (search.sort === defaultSort.id &&
          (!search.dir || (search.dir === 'desc') === defaultSort.desc)));
    if (search.status || clearSort)
      onSearchChange(
        {
          status: undefined,
          tab: tab === 'pending' ? undefined : tab,
          ...(clearSort ? { sort: undefined, dir: undefined } : {}),
        },
        true,
      );
  }, [search.status, search.sort, search.dir, defaultSort, tab, onSearchChange]);
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ListChecksIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('offline-events.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('offline-events.retained-description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex min-w-0 flex-col gap-4 @lg/main:gap-6" ref={measure}>
          <Tabs
            spacing="page"
            value={tab}
            onValueChange={(next) =>
              onSearchChange({
                tab: next === 'pending' ? undefined : (next as OfflineEventsSearch['tab']),
                page: undefined,
                sort: undefined,
                dir: undefined,
                event: undefined,
              })
            }
          >
            <TabsList size="lg" wrap="column" aria-label={t('offline-events.tabs-label')}>
              {tabs.map((value) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  id={`${panelId}-${value}`}
                  aria-controls={panelId}
                >
                  {t(`offline-events.tab-${value}`, {
                    count: local.events?.filter((event) => tabOf(event) === value).length ?? 0,
                  })}
                </TabsTrigger>
              ))}
            </TabsList>
            <div
              role="tabpanel"
              id={panelId}
              aria-labelledby={`${panelId}-${tab}`}
              className="flex min-w-0 flex-col gap-4 @lg/main:gap-6"
            >
              <DataTableToolbar>
                <div className="flex-1 @2xl/main:flex-none">
                  <DataTableFilters
                    size="lg"
                    activeCount={activeEventFilters(search)}
                    onClear={() => onSearchChange(CLEARED_EVENT_FILTERS, true)}
                  >
                    <DataTableSelectFilter
                      allLabel={t('offline-events.type-all')}
                      label={t('offline-events.pending-event')}
                      value={search.eventType ?? ''}
                      options={OFFLINE_EVENT_TYPES.map((kind) => ({
                        value: kind,
                        label: t(EVENT_KINDS[kind].copy.eventType),
                      }))}
                      onValueChange={(eventType) =>
                        onSearchChange(
                          {
                            eventType: (eventType as OfflineEventsSearch['eventType']) || undefined,
                            page: undefined,
                            event: undefined,
                          },
                          true,
                        )
                      }
                    />
                    <DatePicker
                      id="offline-events-start-date"
                      label={t('offline-events.start-date')}
                      placeholder={t('offline-events.start-date')}
                      value={search.startDate ?? ''}
                      latest={search.endDate}
                      clearLabel={t('data-table.clear-filter', {
                        label: t('offline-events.start-date'),
                      })}
                      onValueChange={(startDate) =>
                        onSearchChange(
                          { startDate: startDate || undefined, page: undefined, event: undefined },
                          true,
                        )
                      }
                    />
                    <DatePicker
                      id="offline-events-end-date"
                      label={t('offline-events.end-date')}
                      placeholder={t('offline-events.end-date')}
                      value={search.endDate ?? ''}
                      earliest={search.startDate}
                      clearLabel={t('data-table.clear-filter', {
                        label: t('offline-events.end-date'),
                      })}
                      onValueChange={(endDate) =>
                        onSearchChange(
                          { endDate: endDate || undefined, page: undefined, event: undefined },
                          true,
                        )
                      }
                    />
                  </DataTableFilters>
                </div>
                <div className="@2xl/main:ms-auto">
                  <DataTableViewOptions
                    size="lg"
                    sort={{
                      columns: [
                        { id: 'occurredDate', label: t('offline-events.date') },
                        {
                          id: defaultSort.id,
                          label: t(defaultSort.labelKey),
                        },
                      ],
                      ...searchSort(search, defaultSort, onSearchChange),
                    }}
                    {...view}
                    layout={layout}
                    columns={hideable.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
                  />
                </div>
              </DataTableToolbar>
              <QueryBoundary
                resetKey="offline-events"
                pendingFallback={
                  <OfflineEventsTable
                    local={local}
                    refreshOfflineDownload={refreshOfflineDownload}
                    permissions={permissions}
                    permissionsUpdatedAt={permissionsUpdatedAt}
                    search={search}
                    onSearchChange={onSearchChange}
                    onOpenEvent={onOpenEvent}
                    onCloseEvent={onCloseEvent}
                    columnVisibility={view.visibility}
                    cards={cards}
                    loading
                  />
                }
                errorComponent={({ error, reset }) => (
                  <ListError
                    error={error}
                    reset={reset}
                    title={t('offline-events.error-title')}
                    description={t('offline-events.error-description')}
                  />
                )}
              >
                <OfflineEventsReady
                  local={local}
                  refreshOfflineDownload={refreshOfflineDownload}
                  permissions={permissions}
                  permissionsUpdatedAt={permissionsUpdatedAt}
                  search={search}
                  onSearchChange={onSearchChange}
                  onOpenEvent={onOpenEvent}
                  onCloseEvent={onCloseEvent}
                  columnVisibility={view.visibility}
                  cards={cards}
                />
              </QueryBoundary>
            </div>
          </Tabs>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
function OfflineEventsReady(props: Parameters<typeof OfflineEventsTable>[0]) {
  const timeZone = useDeploymentTimeZone();
  return <OfflineEventsTable {...props} timeZone={timeZone} />;
}
function OfflineEventsTable({
  local,
  search,
  onSearchChange,
  onOpenEvent,
  onCloseEvent,
  columnVisibility,
  cards,
  timeZone,
  loading = false,
  permissions,
  permissionsUpdatedAt,
  refreshOfflineDownload,
}: {
  local: ReturnType<typeof useOfflineEvents>;
  permissions: Permissions;
  permissionsUpdatedAt: number;
  refreshOfflineDownload?: (refreshKey: string) => void;
  search: OfflineEventsSearch;
  onSearchChange: SearchChange<OfflineEventsSearch>;
  onOpenEvent: (event: string) => void;
  onCloseEvent: () => void;
  columnVisibility: Record<string, boolean>;
  cards: boolean;
  timeZone?: string;
  loading?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const tab = offlineEventTab(search);
  const defaultSort = defaultSortByTab[tab];
  const blocked = useMemo(() => blockedScopes(local.events ?? []), [local.events]);

  const listRef = useRef<HTMLDivElement>(null);
  const [removedId, setRemovedId] = useState<string>();
  useEffect(() => {
    if (
      removedId &&
      local.events &&
      !search.event &&
      !local.events.some((event) => event.localEventId === removedId && tabOf(event) === tab)
    ) {
      listRef.current?.focus();
      setRemovedId(undefined);
    }
  }, [removedId, local.events, search.event, tab]);
  const matched = local.events?.find((event) => event.localEventId === search.event);
  const [lastMatched, setLastMatched] = useState(matched);
  const selected =
    matched ?? (lastMatched?.localEventId === search.event ? lastMatched : undefined);
  if (selected !== lastMatched) setLastMatched(selected);
  const deferred = useDeferredValue(search);
  const reviewLabel = useCallback(
    (
      event: DeviceEvent,
      key:
        | 'offline-events.review-event-label'
        | 'offline-events.remove-event-label'
        | 'offline-events.dismiss-event-label'
        | 'offline-events.details-label' = 'offline-events.review-event-label',
    ) =>
      t(key, {
        type: t(EVENT_KINDS[event.kind].copy.eventType),
        date: formatTimestamp(new Date(event.queuedAt).toISOString(), i18n.language, {
          time: true,
          timeZone,
        }),
        status: t(`offline-events.status-${event.status}`),
        count: deviceEventDetails(event).length,
      }),
    [t, i18n.language, timeZone],
  );
  const currentPermissions =
    (local.permissionsFetchedAt ?? 0) > permissionsUpdatedAt
      ? (local.permissions ?? permissions)
      : permissions;
  const canSend = useCallback(
    (event: DeviceEvent) =>
      hasProgramGrant(
        currentPermissions,
        EVENT_KINDS[event.kind].right,
        event.facilityId,
        event.programId,
      ),
    [currentPermissions],
  );
  const columns = useMemo<ColumnDef<DataTableFeatures, DeviceEvent>[]>(
    () => [
      {
        accessorKey: 'kind',
        header: t('offline-events.pending-event'),
        cell: ({ row }) => t(EVENT_KINDS[row.original.kind].copy.eventType),
        meta: { className: 'w-32', label: t('offline-events.pending-event') },
      },
      {
        id: 'facility',
        header: t('facility-program.facility'),
        cell: ({ row }) => <span dir="auto">{tableValue(recordLabel(row.original.facility))}</span>,
        meta: { label: t('facility-program.facility') },
      },
      {
        id: 'program',
        header: t('facility-program.program'),
        cell: ({ row }) => <span dir="auto">{tableValue(recordLabel(row.original.program))}</span>,
        meta: { label: t('facility-program.program') },
      },
      {
        id: 'details',
        header: t('offline-events.line-details'),
        cell: ({ row }) => <DetailsCell event={row.original} />,
        meta: { className: 'w-32', label: t('offline-events.line-details'), skeleton: 'control' },
      },
      ...(tab === 'errors'
        ? [
            {
              id: 'error',
              header: t('offline-events.error-message'),
              cell: ({ row }) => <OfflineEventErrorMessage event={row.original} />,
              meta: { className: '@2xl/main:w-1/4', label: t('offline-events.error-message') },
            } satisfies ColumnDef<DataTableFeatures, DeviceEvent>,
          ]
        : []),
      {
        id: 'occurredDate',
        accessorFn: (event) => occurredDate(event).join(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('offline-events.date')} />
        ),
        cell: ({ row }) => <EventDate event={row.original} />,
        meta: { className: 'w-36', label: t('offline-events.date') },
      },
      ...(tab === 'pending'
        ? [
            {
              accessorKey: 'status',
              header: t('offline-events.status'),
              cell: ({ row }) => <PendingStateCell event={row.original} />,
              meta: { className: 'w-36', label: t('offline-events.status') },
            } satisfies ColumnDef<DataTableFeatures, DeviceEvent>,
          ]
        : [
            {
              id: defaultSort.id,
              accessorFn: (event) =>
                tab === 'errors' ? event.error?.failedAt : event.receipt?.acceptedAt,
              header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t(defaultSort.labelKey)} />
              ),
              cell: ({ getValue }) => {
                const value = getValue<number | undefined>();
                return value === undefined ? null : (
                  <span className="whitespace-nowrap">
                    {formatTimestamp(new Date(value).toISOString(), i18n.language, {
                      time: true,
                      timeZone,
                    })}
                  </span>
                );
              },
              meta: {
                className: 'w-36',
                label: t(defaultSort.labelKey),
              },
            } satisfies ColumnDef<DataTableFeatures, DeviceEvent>,
          ]),
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => <ActionsCell event={row.original} />,
        meta: { className: 'w-12', skeleton: 'control' },
      },
    ],
    [t, tab, defaultSort, i18n.language, timeZone],
  );
  const sorted = useMemo(() => {
    const currentTab = offlineEventTab(deferred);
    const defaultSort = defaultSortByTab[currentTab];
    const field = deferred.sort ?? defaultSort.id;
    const dir = (deferred.dir ? deferred.dir === 'desc' : defaultSort.desc) ? -1 : 1;
    return [...(local.events ?? [])]
      .filter(
        (event) =>
          tabOf(event) === currentTab &&
          (!deferred.eventType || event.kind === deferred.eventType) &&
          ((!deferred.startDate && !deferred.endDate) ||
            occurredDate(event).some(
              (date) =>
                (!deferred.startDate || date >= deferred.startDate) &&
                (!deferred.endDate || date <= deferred.endDate),
            )),
      )
      .sort((a, b) => {
        const aValue = sortValue[field](a);
        const bValue = sortValue[field](b);
        const diff =
          typeof aValue === 'string' && typeof bValue === 'string'
            ? aValue.localeCompare(bValue)
            : Number(aValue) - Number(bValue);
        return diff * dir || a.sequence - b.sequence;
      });
  }, [local.events, deferred]);
  const pagination = toPaginationState(deferred);
  const data = useMemo(
    () =>
      sorted.slice(
        pagination.pageIndex * pagination.pageSize,
        (pagination.pageIndex + 1) * pagination.pageSize,
      ),
    [sorted, pagination.pageIndex, pagination.pageSize],
  );
  const pageStart = usePageStart<HTMLUListElement>(
    `${pagination.pageIndex}:${pagination.pageSize}`,
    cards,
  );
  const searchState = useTableSearchState<OfflineEventsSearch>({
    search: deferred,
    defaultSort,
    onSearchChange: (update) => onSearchChange(update, false, pageStart.navigation),
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (event) => event.localEventId,
    rowCount: sorted.length,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    ...searchState,
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
    state: { ...searchState.state, columnVisibility },
  });
  const last = Math.max(1, Math.ceil(sorted.length / pagination.pageSize));
  useEffect(() => {
    if (local.events && (deferred.page ?? 1) > last)
      onSearchChange({ page: last > 1 ? last : undefined }, true);
  }, [local.events, deferred.page, last, onSearchChange]);
  if (local.error)
    return (
      <ListError
        error={local.error}
        reset={local.retry}
        title={t('offline-events.error-title')}
        description={t('offline-events.error-description')}
      />
    );
  if (loading || !local.events)
    return cards ? (
      <TableCardsSkeleton
        table={table}
        title="kind"
        rowCount={pagination.pageSize}
        actions={tab === 'errors' ? 3 : 2}
      />
    ) : (
      <DataTableSkeleton table={table} rowCount={pagination.pageSize} />
    );
  const filtered = activeEventFilters(search) > 0;
  const empty =
    sorted.length === 0 ? (
      <DataTableEmpty
        icon={<ListChecksIcon />}
        title={t(filtered ? 'offline-events.no-matches-title' : emptyByTab[tab].title)}
        description={t(
          filtered ? 'offline-events.no-matches-description' : emptyByTab[tab].description,
        )}
        action={
          filtered ? (
            <Button
              variant="destructive"
              onClick={() => onSearchChange(CLEARED_EVENT_FILTERS, true)}
            >
              {t('data-table.clear-filters')}
            </Button>
          ) : undefined
        }
      />
    ) : undefined;
  return (
    <EventCellsContext
      value={{ blocked, canSend, reviewLabel, onOpenEvent, onRemoved: setRemovedId }}
    >
      {search.event && !selected && (
        <FormDialog
          open
          onOpenChange={(open) => {
            if (!open) onCloseEvent();
          }}
        >
          <DialogNotFound
            title={t('offline-events.not-found-title')}
            description={t('offline-events.not-found-description')}
          />
        </FormDialog>
      )}
      {selected && (
        <DeviceEventRecovery
          refreshOfflineDownload={refreshOfflineDownload}
          event={selected}
          canView={hasProgramGrant(
            currentPermissions,
            RIGHTS.stockCardsView,
            selected.facilityId,
            selected.programId,
          )}
          canSend={canSend(selected)}
          timeZone={timeZone}
          onClose={onCloseEvent}
          onRemoved={() => setRemovedId(selected.localEventId)}
        />
      )}
      <div ref={listRef} tabIndex={-1} className="min-w-0 outline-none">
        {cards ? (
          <TableCards
            table={table}
            title="kind"
            busy={search !== deferred}
            empty={empty}
            listRef={pageStart.ref}
            footer={sorted.length > 0 && <DataTablePagination table={table} />}
          />
        ) : (
          <DataTable
            table={table}
            layout="auto"
            isStale={search !== deferred}
            empty={empty}
            footer={sorted.length > 0 && <DataTablePagination table={table} />}
          />
        )}
      </div>
    </EventCellsContext>
  );
}
