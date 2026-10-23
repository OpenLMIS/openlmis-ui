import { type ColumnDef, useTable } from '@tanstack/react-table';
import { ListChecksIcon } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CardActionsSkeleton } from '@/components/card-actions';
import {
  CardBand,
  CardList,
  CardListItem,
  CardListSkeleton,
  CardRows,
  SkeletonBar,
} from '@/components/card-list';
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
import { DialogNotFound } from '@/components/dialog-parts';
import { formatDateValue, formatTimestamp } from '@/components/form/date-value';
import { DatePicker } from '@/components/form/form-fields';
import { SettingsItem, SettingsRowFrame } from '@/components/form/settings-list';
import { FormDialog } from '@/components/form-dialog/form-dialog';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
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
import { EventStatus } from '@/features/stock-events/components/event-status';
import { useOfflineEvents } from '@/features/stock-events/hooks/use-offline-events';
import { deviceEventDetails } from '@/features/stock-events/lib/device-event-details';
import {
  COUNTERPARTY,
  EVENT_KINDS,
  OFFLINE_EVENT_TYPES,
} from '@/features/stock-events/lib/event-kinds';
import {
  activeEventFilters,
  CLEARED_EVENT_FILTERS,
  type OfflineEventsSearch,
} from '@/features/stock-events/lib/offline-events-search';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { useCardView } from '@/hooks/use-card-view';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePageStart } from '@/hooks/use-page-start';
import { orEmpty, tableValue } from '@/lib/empty-value';
import { recordLabel } from '@/lib/facility-program-selection';
import { hasProgramGrant, type Permissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import {
  type SearchChange,
  searchSort,
  toPaginationState,
  useTableSearchState,
} from '@/lib/table-search';
import { cn } from '@/lib/utils';

const hideable = [
  { id: 'facility', labelKey: 'facility-program.facility', hideBelow: '5xl' },
  { id: 'program', labelKey: 'facility-program.program', hideBelow: '4xl' },
  { id: 'details', labelKey: 'offline-events.line-details' },
  { id: 'occurredDate', labelKey: 'offline-events.occurred-date' },
  { id: 'status', labelKey: 'offline-events.status' },
] as const;
const defaultSort = { id: 'occurredDate', desc: true };
const statuses = ['queued', 'sending', 'uncertain', 'refused', 'accepted'] as const;
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

function EventLines({ event, layout }: { event: DeviceEvent; layout: 'table' | 'cards' }) {
  const { t, i18n } = useTranslation();
  const side = EVENT_KINDS[event.kind].counterparty;
  const quantity = new Intl.NumberFormat(i18n.language);
  return (
    <ul
      className={cn(
        'flex flex-col gap-2 whitespace-normal text-sm',
        layout === 'table' ? 'min-w-48' : 'text-end',
      )}
    >
      {deviceEventDetails(event).map((line) => {
        const party = side === 'none' ? line.reason : line.counterparty;
        return (
          <li
            className={cn('flex min-w-0 flex-col gap-0.5', layout === 'cards' && 'items-end')}
            key={line.key}
          >
            <span className="font-semibold">
              <bdi>{line.product}</bdi>
            </span>
            <dl
              className={cn(
                'flex flex-wrap gap-x-3 gap-y-0.5',
                layout === 'cards' && 'justify-end',
              )}
            >
              <EventLineDetail label={t('offline-events.lot')}>
                {line.lotCode ??
                  t(
                    line.productHasLots
                      ? 'stock-events.no-lot-defined'
                      : 'stock-events.product-has-no-lots',
                  )}
              </EventLineDetail>
              {party && (
                <EventLineDetail
                  label={t(side === 'none' ? 'offline-events.reason' : COUNTERPARTY[side].column)}
                >
                  {party}
                </EventLineDetail>
              )}
              <EventLineDetail label={t('offline-events.quantity')}>
                {quantity.format(line.item.quantity)}
              </EventLineDetail>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

function EventLineDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-1">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-break-word font-medium">
        <bdi>{children}</bdi>
      </dd>
    </div>
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
  const {
    measure,
    cards,
    columnView: view,
    layout,
  } = useCardView(hideable, 'device-events.columns');
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
          <DataTableToolbar>
            <div className="flex-1 @2xl/main:flex-none">
              <DataTableFilters
                size="lg"
                activeCount={activeEventFilters(search)}
                onClear={() => onSearchChange(CLEARED_EVENT_FILTERS, true)}
              >
                <DataTableSelectFilter
                  label={t('offline-events.status')}
                  value={search.status ?? ''}
                  onValueChange={(status) =>
                    onSearchChange(
                      {
                        status: (status as OfflineEventsSearch['status']) || undefined,
                        page: undefined,
                        event: undefined,
                      },
                      true,
                    )
                  }
                  options={statuses.map((value) => ({
                    value,
                    label: t(`offline-events.status-${value}`),
                  }))}
                />
                <DataTableSelectFilter
                  allLabel={t('offline-events.type-all')}
                  label={t('offline-events.type')}
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
                    { id: 'occurredDate', label: t('offline-events.occurred-date') },
                    { id: 'queuedAt', label: t('offline-events.queued-at') },
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
  const local = useOfflineEvents(!loading);
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
        | 'offline-events.remove-event-label' = 'offline-events.review-event-label',
    ) =>
      t(key, {
        type: t(EVENT_KINDS[event.kind].copy.eventType),
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
        header: t('offline-events.type'),
        cell: ({ row }) => t(EVENT_KINDS[row.original.kind].copy.eventType),
        meta: { className: 'w-32' },
      },
      {
        id: 'facility',
        header: t('facility-program.facility'),
        cell: ({ row }) => <span dir="auto">{tableValue(recordLabel(row.original.facility))}</span>,
      },
      {
        id: 'program',
        header: t('facility-program.program'),
        cell: ({ row }) => <span dir="auto">{tableValue(recordLabel(row.original.program))}</span>,
      },
      {
        id: 'details',
        header: t('offline-events.line-details'),
        cell: ({ row }) => <EventLines event={row.original} layout="table" />,
      },
      {
        id: 'occurredDate',
        accessorFn: (event) => occurredDate(event).join(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('offline-events.occurred-date')} />
        ),
        cell: ({ row }) => <EventDate event={row.original} />,
        meta: { className: 'w-36' },
      },
      {
        accessorKey: 'status',
        header: t('offline-events.status'),
        cell: ({ row }) => <EventStatus event={row.original} />,
        meta: { className: 'w-36' },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DeviceEventActions
            canSend={canSend(row.original)}
            event={row.original}
            label={reviewLabel(row.original)}
            removeLabel={reviewLabel(row.original, 'offline-events.remove-event-label')}
            onOpen={() => onOpenEvent(row.original.localEventId)}
            onRemoved={() => setRemovedId(row.original.localEventId)}
          />
        ),
        meta: { className: 'w-12', skeleton: 'control' },
      },
    ],
    [t, reviewLabel, onOpenEvent, canSend],
  );
  const sorted = useMemo(
    () =>
      [...(local.events ?? [])]
        .filter(
          (event) =>
            (!deferred.status || event.status === deferred.status) &&
            (!deferred.eventType || event.kind === deferred.eventType) &&
            ((!deferred.startDate && !deferred.endDate) ||
              occurredDate(event).some(
                (date) =>
                  (!deferred.startDate || date >= deferred.startDate) &&
                  (!deferred.endDate || date <= deferred.endDate),
              )),
        )
        .sort(
          (a, b) =>
            ((deferred.sort === 'queuedAt'
              ? 0
              : occurredDate(a).join().localeCompare(occurredDate(b).join())) ||
              a.queuedAt - b.queuedAt ||
              (a.sequence ?? 0) - (b.sequence ?? 0)) *
            ((deferred.dir ? deferred.dir === 'desc' : defaultSort.desc) ? -1 : 1),
        ),
    [
      local.events,
      deferred.dir,
      deferred.sort,
      deferred.status,
      deferred.eventType,
      deferred.startDate,
      deferred.endDate,
    ],
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
      <CardListSkeleton
        count={pagination.pageSize}
        rows={hideable.filter(({ id }) => columnVisibility[id] !== false).length}
        band={
          <>
            <SkeletonBar width="w-24" />
            <CardActionsSkeleton count={2} />
          </>
        }
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
            : 'offline-events.no-events-title',
        )}
        description={t(
          activeEventFilters(search)
            ? 'offline-events.no-matches-description'
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
          <CardList
            busy={search !== deferred}
            empty={empty}
            listRef={pageStart.ref}
            footer={sorted.length > 0 && <DataTablePagination table={table} />}
          >
            {data.map((event) => (
              <CardListItem key={event.localEventId}>
                <CardBand>
                  <span>{t(EVENT_KINDS[event.kind].copy.eventType)}</span>
                  <DeviceEventActions
                    layout="cards"
                    canSend={canSend(event)}
                    event={event}
                    label={reviewLabel(event)}
                    removeLabel={reviewLabel(event, 'offline-events.remove-event-label')}
                    onOpen={() => onOpenEvent(event.localEventId)}
                    onRemoved={() => setRemovedId(event.localEventId)}
                  />
                </CardBand>
                <CardRows>
                  {columnVisibility.facility !== false && (
                    <SettingsItem label={t('facility-program.facility')}>
                      <span dir="auto">{orEmpty(recordLabel(event.facility))}</span>
                    </SettingsItem>
                  )}
                  {columnVisibility.program !== false && (
                    <SettingsItem label={t('facility-program.program')}>
                      <span dir="auto">{orEmpty(recordLabel(event.program))}</span>
                    </SettingsItem>
                  )}
                  {columnVisibility.details !== false && (
                    <SettingsRowFrame
                      value="wide"
                      label={<span className="text-sm">{t('offline-events.line-details')}</span>}
                    >
                      <EventLines event={event} layout="cards" />
                    </SettingsRowFrame>
                  )}
                  {columnVisibility.occurredDate !== false && (
                    <SettingsItem label={t('offline-events.occurred-date')}>
                      <EventDate event={event} />
                    </SettingsItem>
                  )}
                  {columnVisibility.status !== false && (
                    <SettingsItem label={t('offline-events.status')}>
                      <EventStatus event={event} />
                    </SettingsItem>
                  )}
                </CardRows>
              </CardListItem>
            ))}
          </CardList>
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
