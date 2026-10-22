import { type ColumnDef, useTable } from '@tanstack/react-table';
import { ListChecksIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
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
import { DeviceEventRecovery } from '@/features/stock-events/components/device-event-recovery';
import { OfflineEventDetails } from '@/features/stock-events/components/offline-event-details';
import {
  OfflineEventErrorMessage,
  OfflineEventPendingState,
} from '@/features/stock-events/components/offline-event-state';
import { useOfflineEvents } from '@/features/stock-events/hooks/use-offline-events';
import { EVENT_KINDS, OFFLINE_EVENT_TYPES } from '@/features/stock-events/lib/event-kinds';
import {
  compareErrorEvents,
  comparePendingEvents,
  compareSyncedEvents,
  tabOf,
} from '@/features/stock-events/lib/offline-event-tabs';
import {
  activeEventFilters,
  CLEARED_EVENT_FILTERS,
  type OfflineEventsSearch,
  offlineEventTab,
} from '@/features/stock-events/lib/offline-events-search';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { blockedScopes } from '@/features/stock-events/lib/stock-event-sync';
import { useCardLayout } from '@/hooks/use-card-view';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePageStart } from '@/hooks/use-page-start';
import { useStoredState } from '@/hooks/use-stored-state';
import { hasProgramGrant, type Permissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import {
  type SearchChange,
  searchSort,
  toPaginationState,
  useTableSearchState,
} from '@/lib/table-search';

const tabs = ['pending', 'errors', 'synced'] as const;
const hideableByTab = {
  pending: [{ id: 'status', labelKey: 'offline-events.status' }],
  errors: [{ id: 'failedAt', labelKey: 'offline-events.failed-at' }],
  synced: [{ id: 'acceptedAt', labelKey: 'offline-events.synced-at' }],
} as const;
const defaultSortByTab = {
  pending: { id: 'queuedAt', desc: false },
  errors: { id: 'failedAt', desc: false },
  synced: { id: 'acceptedAt', desc: true },
};
const compareByTab = {
  pending: comparePendingEvents,
  errors: compareErrorEvents,
  synced: compareSyncedEvents,
};
const choicesSchema = z.record(z.string(), z.boolean());

const occurredDate = (event: DeviceEvent) =>
  [...new Set(event.payload.lineItems.map((line) => line.occurredDate).filter(Boolean))].sort();

function EventDate({ event }: { event: DeviceEvent }) {
  const { i18n } = useTranslation();
  return occurredDate(event).map((date) => (
    <time className="block" dateTime={date} key={date}>
      {formatDateValue(date, i18n.language)}
    </time>
  ));
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
            value={tab}
            onValueChange={(next) =>
              onSearchChange({
                tab: next === 'pending' ? undefined : (next as OfflineEventsSearch['tab']),
                status: undefined,
                page: undefined,
                sort: undefined,
                dir: undefined,
                event: undefined,
              })
            }
          >
            <TabsList size="lg" wrap="column" aria-label={t('offline-events.title')}>
              {tabs.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {t(`offline-events.tab-${value}`, {
                    count: local.events?.filter((event) => tabOf(event) === value).length ?? 0,
                  })}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <DataTableToolbar>
            <div className="flex-1 @2xl/main:flex-none">
              <DataTableFilters
                size="lg"
                activeCount={activeEventFilters(search)}
                onClear={() => onSearchChange(CLEARED_EVENT_FILTERS, true)}
              >
                <DataTableSelectFilter
                  allLabel={t('offline-events.type-all')}
                  label={t('offline-events.type')}
                  value={search.eventType ?? ''}
                  options={OFFLINE_EVENT_TYPES.map((kind) => ({
                    value: kind,
                    label: t(EVENT_KINDS[kind].copy.label),
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
                  clearLabel={t('data-table.clear-filter', { label: t('offline-events.end-date') })}
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
                      label: t(
                        tab === 'pending'
                          ? 'offline-events.queued-at'
                          : tab === 'errors'
                            ? 'offline-events.failed-at'
                            : 'offline-events.synced-at',
                      ),
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
  const blocked = useMemo(
    () =>
      blockedScopes(
        (local.events ?? []).filter(
          (event): event is QueuedStockEvent =>
            event.status === 'queued' || event.status === 'sending' || event.status === 'uncertain',
        ),
      ),
    [local.events],
  );

  const listRef = useRef<HTMLDivElement>(null);
  const [removedId, setRemovedId] = useState<string>();
  useEffect(() => {
    if (
      removedId &&
      local.events &&
      !local.events.some((event) => event.localEventId === removedId)
    ) {
      listRef.current?.focus();
      setRemovedId(undefined);
    }
  }, [removedId, local.events]);
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
        | 'offline-events.dismiss-event-label' = 'offline-events.review-event-label',
    ) =>
      t(key, {
        type: t(EVENT_KINDS[event.kind].copy.label),
        date: formatTimestamp(new Date(event.queuedAt).toISOString(), i18n.language, {
          time: true,
          timeZone,
        }),
        status: t(`offline-events.status-${event.status}`),
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
        cell: ({ row }) => t(EVENT_KINDS[row.original.kind].copy.label),
        meta: { className: 'w-32', label: t('offline-events.pending-event') },
      },
      {
        id: 'details',
        header: t('offline-events.details-column'),
        cell: ({ row }) => <OfflineEventDetails event={row.original} />,
        meta: { label: t('offline-events.details-column') },
      },
      ...(tab === 'errors'
        ? [
            {
              id: 'error',
              header: t('offline-events.error-message'),
              cell: ({ row }) => <OfflineEventErrorMessage event={row.original} />,
              meta: { label: t('offline-events.error-message') },
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
              cell: ({ row }) => (
                <OfflineEventPendingState event={row.original} blocked={blocked} />
              ),
              meta: { className: 'w-36', label: t('offline-events.status') },
            } satisfies ColumnDef<DataTableFeatures, DeviceEvent>,
          ]
        : [
            {
              id: defaultSort.id,
              accessorFn: (event) =>
                tab === 'errors' ? event.error?.failedAt : event.receipt?.acceptedAt,
              header: ({ column }) => (
                <DataTableColumnHeader
                  column={column}
                  title={t(
                    tab === 'errors' ? 'offline-events.failed-at' : 'offline-events.synced-at',
                  )}
                />
              ),
              cell: ({ row }) => {
                const value =
                  tab === 'errors'
                    ? row.original.error?.failedAt
                    : row.original.receipt?.acceptedAt;
                return value === undefined
                  ? null
                  : formatTimestamp(new Date(value).toISOString(), i18n.language, {
                      time: true,
                      timeZone,
                    });
              },
              meta: {
                className: 'w-36',
                label: t(
                  tab === 'errors' ? 'offline-events.failed-at' : 'offline-events.synced-at',
                ),
              },
            } satisfies ColumnDef<DataTableFeatures, DeviceEvent>,
          ]),
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DeviceEventActions
            canSend={canSend(row.original)}
            event={row.original}
            label={reviewLabel(row.original)}
            removeLabel={reviewLabel(
              row.original,
              row.original.status === 'refused'
                ? 'offline-events.dismiss-event-label'
                : 'offline-events.remove-event-label',
            )}
            onOpen={() => onOpenEvent(row.original.localEventId)}
            onRemoved={() => setRemovedId(row.original.localEventId)}
          />
        ),
        meta: { className: 'w-12', skeleton: 'control' },
      },
    ],
    [t, reviewLabel, onOpenEvent, canSend, tab, defaultSort.id, blocked, i18n.language, timeZone],
  );
  const sorted = useMemo(
    () =>
      [...(local.events ?? [])]
        .filter(
          (event) =>
            tabOf(event) === offlineEventTab(deferred) &&
            (!deferred.eventType || event.kind === deferred.eventType) &&
            ((!deferred.startDate && !deferred.endDate) ||
              occurredDate(event).some(
                (date) =>
                  (!deferred.startDate || date >= deferred.startDate) &&
                  (!deferred.endDate || date <= deferred.endDate),
              )),
        )
        .sort((a, b) => {
          const currentTab = offlineEventTab(deferred);
          if (!deferred.sort && !deferred.dir) return compareByTab[currentTab](a, b);
          const field = deferred.sort ?? defaultSortByTab[currentTab].id;
          const value =
            field === 'occurredDate'
              ? occurredDate(a).join().localeCompare(occurredDate(b).join())
              : field === 'failedAt'
                ? (a.error?.failedAt ?? 0) - (b.error?.failedAt ?? 0)
                : field === 'acceptedAt'
                  ? (a.receipt?.acceptedAt ?? 0) - (b.receipt?.acceptedAt ?? 0)
                  : a.queuedAt - b.queuedAt;
          return (
            value *
              ((deferred.dir ? deferred.dir === 'desc' : defaultSortByTab[currentTab].desc)
                ? -1
                : 1) || compareByTab[currentTab](a, b)
          );
        }),
    [local.events, deferred],
  );
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
  const empty =
    sorted.length === 0 ? (
      <DataTableEmpty
        icon={<ListChecksIcon />}
        title={t(
          activeEventFilters(search)
            ? 'offline-events.no-matches-title'
            : tab === 'errors'
              ? 'offline-events.no-errors-title'
              : tab === 'synced'
                ? 'offline-events.no-synced-title'
                : 'offline-events.no-events-title',
        )}
        description={t(
          activeEventFilters(search)
            ? 'offline-events.no-matches-description'
            : tab === 'errors'
              ? 'offline-events.no-errors-description'
              : tab === 'synced'
                ? 'offline-events.no-synced-description'
                : 'offline-events.no-events-description',
        )}
        action={
          activeEventFilters(search) ? (
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
    <>
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
    </>
  );
}
