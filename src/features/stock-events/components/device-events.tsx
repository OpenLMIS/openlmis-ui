import { type ColumnDef, useTable } from '@tanstack/react-table';
import { ListChecksIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
import { SettingsItem } from '@/components/form/settings-list';
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
import { useDeviceEvents } from '@/features/stock-events/hooks/use-device-events';
import type { DeviceEventsSearch } from '@/features/stock-events/lib/device-events-search';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { useCardView } from '@/hooks/use-card-view';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePageStart } from '@/hooks/use-page-start';
import { orEmpty, tableValue } from '@/lib/empty-value';
import { recordLabel } from '@/lib/facility-program-selection';
import { hasProgramGrant, type Permissions } from '@/lib/permissions';
import {
  type SearchChange,
  searchSort,
  toPaginationState,
  useTableSearchState,
} from '@/lib/table-search';

const hideable = [
  { id: 'facility', labelKey: 'facility-program.facility', hideBelow: '3xl' },
  { id: 'program', labelKey: 'facility-program.program', hideBelow: '4xl' },
  { id: 'occurredDate', labelKey: 'device-events.occurred-date' },
  { id: 'status', labelKey: 'device-events.status' },
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

export function DeviceEventsPage({
  search,
  onSearchChange,
  onOpenEvent,
  onCloseEvent,
  permissions,
  permissionsUpdatedAt,
}: {
  permissions: Permissions;
  permissionsUpdatedAt: number;
  search: DeviceEventsSearch;
  onSearchChange: SearchChange<DeviceEventsSearch>;
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
          <WorkspaceTitle>{t('device-events.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('device-events.retained-description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6" ref={measure}>
          <DataTableToolbar>
            <div className="flex-1 @2xl/main:flex-none">
              <DataTableFilters
                size="lg"
                activeCount={search.status ? 1 : 0}
                onClear={() =>
                  onSearchChange({ status: undefined, page: undefined, event: undefined }, true)
                }
              >
                <DataTableSelectFilter
                  label={t('device-events.status')}
                  value={search.status ?? ''}
                  onValueChange={(status) =>
                    onSearchChange(
                      {
                        status: (status as DeviceEventsSearch['status']) || undefined,
                        page: undefined,
                        event: undefined,
                      },
                      true,
                    )
                  }
                  options={statuses.map((value) => ({
                    value,
                    label: t(`device-events.status-${value}`),
                  }))}
                />
              </DataTableFilters>
            </div>
            <div className="@2xl/main:ms-auto">
              <DataTableViewOptions
                size="lg"
                sort={{
                  columns: [
                    { id: 'occurredDate', label: t('device-events.occurred-date') },
                    { id: 'queuedAt', label: t('device-events.queued-at') },
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
            resetKey="device-events"
            pendingFallback={
              <DeviceEventsTable
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
                title={t('device-events.error-title')}
                description={t('device-events.error-description')}
              />
            )}
          >
            <DeviceEventsReady
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
function DeviceEventsReady(props: Parameters<typeof DeviceEventsTable>[0]) {
  const timeZone = useDeploymentTimeZone();
  return <DeviceEventsTable {...props} timeZone={timeZone} />;
}
function DeviceEventsTable({
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
}: {
  permissions: Permissions;
  permissionsUpdatedAt: number;
  search: DeviceEventsSearch;
  onSearchChange: SearchChange<DeviceEventsSearch>;
  onOpenEvent: (event: string) => void;
  onCloseEvent: () => void;
  columnVisibility: Record<string, boolean>;
  cards: boolean;
  timeZone?: string;
  loading?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const local = useDeviceEvents(!loading);
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
        | 'device-events.review-event-label'
        | 'device-events.remove-event-label' = 'device-events.review-event-label',
    ) =>
      t(key, {
        type: t(EVENT_KINDS[event.kind].copy.label),
        date: formatTimestamp(new Date(event.queuedAt).toISOString(), i18n.language, {
          time: true,
          timeZone,
        }),
        status: t(`device-events.status-${event.status}`),
      }),
    [t, i18n.language, timeZone],
  );
  const columns = useMemo<ColumnDef<DataTableFeatures, DeviceEvent>[]>(
    () => [
      {
        accessorKey: 'kind',
        header: t('device-events.type'),
        cell: ({ row }) => t(EVENT_KINDS[row.original.kind].copy.label),
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
        id: 'occurredDate',
        accessorFn: (event) => occurredDate(event).join(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('device-events.occurred-date')} />
        ),
        cell: ({ row }) => <EventDate event={row.original} />,
        meta: { className: 'w-36' },
      },
      {
        accessorKey: 'status',
        header: t('device-events.status'),
        cell: ({ row }) => <EventStatus event={row.original} />,
        meta: { className: 'w-36' },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DeviceEventActions
            event={row.original}
            label={reviewLabel(row.original)}
            removeLabel={reviewLabel(row.original, 'device-events.remove-event-label')}
            onOpen={() => onOpenEvent(row.original.localEventId)}
            onRemoved={() => setRemovedId(row.original.localEventId)}
          />
        ),
        meta: { className: 'w-12', skeleton: 'control' },
      },
    ],
    [t, reviewLabel, onOpenEvent],
  );
  const sorted = useMemo(
    () =>
      [...(local.events ?? [])]
        .filter((event) => !deferred.status || event.status === deferred.status)
        .sort(
          (a, b) =>
            ((deferred.sort === 'queuedAt'
              ? 0
              : occurredDate(a).join().localeCompare(occurredDate(b).join())) ||
              a.queuedAt - b.queuedAt ||
              (a.sequence ?? 0) - (b.sequence ?? 0)) *
            ((deferred.dir ? deferred.dir === 'desc' : defaultSort.desc) ? -1 : 1),
        ),
    [local.events, deferred.dir, deferred.sort, deferred.status],
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
  const searchState = useTableSearchState<DeviceEventsSearch>({
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
        title={t('device-events.error-title')}
        description={t('device-events.error-description')}
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
          search.status ? 'device-events.no-matches-title' : 'device-events.no-events-title',
        )}
        description={t(
          search.status
            ? 'device-events.no-matches-description'
            : 'device-events.no-events-description',
        )}
        action={
          search.status ? (
            <Button
              variant="destructive"
              onClick={() => onSearchChange({ status: undefined, page: undefined }, true)}
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
            title={t('device-events.not-found-title')}
            description={t('device-events.not-found-description')}
          />
        </FormDialog>
      )}
      {selected && (
        <DeviceEventRecovery
          event={selected}
          canView={hasProgramGrant(
            (local.permissionsFetchedAt ?? 0) > permissionsUpdatedAt
              ? (local.permissions ?? permissions)
              : permissions,
            'STOCK_CARDS_VIEW',
            selected.facilityId,
            selected.programId,
          )}
          canSend={hasProgramGrant(
            (local.permissionsFetchedAt ?? 0) > permissionsUpdatedAt
              ? (local.permissions ?? permissions)
              : permissions,
            EVENT_KINDS[selected.kind].right,
            selected.facilityId,
            selected.programId,
          )}
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
                  <span>{t(EVENT_KINDS[event.kind].copy.label)}</span>
                  <DeviceEventActions
                    layout="cards"
                    event={event}
                    label={reviewLabel(event)}
                    removeLabel={reviewLabel(event, 'device-events.remove-event-label')}
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
                  {columnVisibility.occurredDate !== false && (
                    <SettingsItem label={t('device-events.occurred-date')}>
                      <EventDate event={event} />
                    </SettingsItem>
                  )}
                  {columnVisibility.status !== false && (
                    <SettingsItem label={t('device-events.status')}>
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
