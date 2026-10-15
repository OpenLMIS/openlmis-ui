import { type ColumnDef, useTable } from '@tanstack/react-table';
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleXIcon,
  ClockIcon,
  ListChecksIcon,
  MoreHorizontalIcon,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
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
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { DialogNotFound } from '@/components/dialog-parts';
import { formatDateValue, formatTimestamp } from '@/components/form/date-value';
import { FormDialog } from '@/components/form-dialog/form-dialog';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { DeviceEventRecovery } from '@/features/stock-events/components/device-event-recovery';
import { useDeviceEvents } from '@/features/stock-events/hooks/use-device-events';
import type { DeviceEventsSearch } from '@/features/stock-events/lib/device-events-search';
import { kindLabels } from '@/features/stock-events/lib/kind-labels';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { useStoredState } from '@/hooks/use-stored-state';
import { recordLabel } from '@/lib/facility-program-selection';
import { hasProgramGrant, type Permissions } from '@/lib/permissions';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const choicesSchema = z.record(z.string(), z.boolean());
const hideable = [
  { id: 'facility', labelKey: 'facility-program.facility', hideBelow: '2xl' },
  { id: 'program', labelKey: 'facility-program.program', hideBelow: 1280 },
  { id: 'lots', labelKey: 'device-events.lots', hideBelow: 1180 },
  { id: 'kind', labelKey: 'device-events.type', hideBelow: 1180 },
  { id: 'queuedAt', labelKey: 'device-events.queued-at', hideBelow: 'xl' },
  { id: 'quantity', labelKey: 'device-events.quantity', hideBelow: 'sm' },
  { id: 'reason', labelKey: 'device-events.reason', hideBelow: '3xl' },
  { id: 'occurredDate', labelKey: 'device-events.occurred-date', hideBelow: 'md' },
  { id: 'status', labelKey: 'device-events.status' },
] as const;
type EventRow = DeviceEvent & { lineIndex: number };
const defaultSort = { id: 'queuedAt', desc: false };

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
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const view = useColumnVisibility(
    hideable,
    useStoredState('device-events.columns', choicesSchema, {}),
    width,
  );
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
        <div className="flex min-w-0 flex-col gap-4" ref={measure}>
          <DataTableToolbar>
            <div className="ms-auto">
              <DataTableViewOptions
                {...view}
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
  timeZone?: string;
  loading?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const local = useDeviceEvents(!loading);
  const selected = local.events?.find((event) => event.localEventId === search.event);
  const deferred = useDeferredValue(search);
  const columns = useMemo<ColumnDef<DataTableFeatures, EventRow>[]>(
    () => [
      {
        accessorKey: 'kind',
        header: t('device-events.type'),
        cell: ({ row }) => (row.original.lineIndex === 0 ? t(kindLabels[row.original.kind]) : null),
        meta: { className: 'w-32' },
      },
      {
        id: 'facility',
        header: t('facility-program.facility'),
        cell: ({ row }) =>
          row.original.lineIndex === 0 ? (
            <span dir="auto">{recordLabel(row.original.facility)}</span>
          ) : null,
      },
      {
        id: 'program',
        header: t('facility-program.program'),
        cell: ({ row }) =>
          row.original.lineIndex === 0 ? (
            <span dir="auto">{recordLabel(row.original.program)}</span>
          ) : null,
      },
      {
        id: 'products',
        header: t('device-events.products'),
        cell: ({ row }) => (
          <span className="block min-w-24 whitespace-normal" dir="auto">
            {row.original.lines[row.original.lineIndex]?.orderable.fullProductName ||
              row.original.lines[row.original.lineIndex]?.orderable.productCode}
          </span>
        ),
      },
      {
        id: 'lots',
        header: t('device-events.lots'),
        cell: ({ row }) => (
          <span dir="auto">{row.original.lines[row.original.lineIndex]?.lot?.lotCode}</span>
        ),
      },
      {
        id: 'quantity',
        header: t('device-events.quantity'),
        cell: ({ row }) => {
          const item = row.original.payload.lineItems[row.original.lineIndex];
          return item ? new Intl.NumberFormat(i18n.language).format(item.quantity) : null;
        },
      },
      {
        id: 'reason',
        header: t('device-events.reason'),
        cell: ({ row }) => {
          const item = row.original.payload.lineItems[row.original.lineIndex];
          return (
            <span dir="auto">
              {row.original.reasons?.find((reason) => reason.id === item?.reasonId)?.name}
            </span>
          );
        },
      },
      {
        id: 'occurredDate',
        header: t('device-events.occurred-date'),
        cell: ({ row }) =>
          formatDateValue(
            row.original.payload.lineItems[row.original.lineIndex]?.occurredDate,
            i18n.language,
          ),
      },
      {
        accessorKey: 'queuedAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('device-events.queued-at')} />
        ),
        cell: ({ row }) =>
          row.original.lineIndex === 0 ? (
            <time dateTime={new Date(row.original.queuedAt).toISOString()}>
              <span className="block whitespace-normal">
                {formatTimestamp(new Date(row.original.queuedAt).toISOString(), i18n.language, {
                  time: true,
                  timeZone,
                })}
              </span>
            </time>
          ) : null,
      },
      {
        accessorKey: 'status',
        header: t('device-events.status'),
        cell: ({ row }) =>
          row.original.lineIndex === 0 ? (
            <Badge
              variant={
                row.original.status === 'uncertain'
                  ? 'warning'
                  : row.original.status === 'refused'
                    ? 'destructive'
                    : row.original.status === 'accepted'
                      ? 'success'
                      : 'secondary'
              }
            >
              {row.original.status === 'uncertain' ? (
                <AlertTriangleIcon data-icon="inline-start" />
              ) : row.original.status === 'refused' ? (
                <CircleXIcon data-icon="inline-start" />
              ) : row.original.status === 'accepted' ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <ClockIcon data-icon="inline-start" />
              )}
              {t(
                row.original.receipt?.source === 'user'
                  ? 'device-events.recorded-by-you'
                  : `device-events.status-${row.original.status}`,
              )}
            </Badge>
          ) : null,
        meta: { className: 'w-36' },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          row.original.lineIndex === 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('device-events.review-event-label', {
                      type: t(kindLabels[row.original.kind]),
                      date: formatTimestamp(
                        new Date(row.original.queuedAt).toISOString(),
                        i18n.language,
                        { time: true, timeZone },
                      ),
                      status: t(`device-events.status-${row.original.status}`),
                    })}
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => onOpenEvent(row.original.localEventId)}>
                    {t('device-events.review-event')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null,
        meta: { className: 'w-12' },
      },
    ],
    [t, i18n.language, timeZone, onOpenEvent],
  );
  const sorted = useMemo(
    () =>
      [...(local.events ?? [])].sort(
        (a, b) =>
          (a.queuedAt - b.queuedAt || (a.sequence ?? 0) - (b.sequence ?? 0)) *
          (deferred.dir === 'desc' ? -1 : 1),
      ),
    [local.events, deferred.dir],
  );
  const pagination = toPaginationState(deferred);
  const data = useMemo(
    () =>
      sorted
        .slice(
          pagination.pageIndex * pagination.pageSize,
          (pagination.pageIndex + 1) * pagination.pageSize,
        )
        .flatMap((event) =>
          Array.from({ length: Math.max(1, event.lines.length) }, (_, lineIndex) => ({
            ...event,
            lineIndex,
          })),
        ),
    [sorted, pagination.pageIndex, pagination.pageSize],
  );
  const searchState = useTableSearchState({ search: deferred, defaultSort, onSearchChange });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (event) => `${event.localEventId}:${event.lineIndex}`,
    rowCount: sorted.length,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    ...searchState,
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
    return <DataTableSkeleton table={table} rowCount={pagination.pageSize} />;
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
            'STOCK_ADJUST',
            selected.facilityId,
            selected.programId,
          )}
          timeZone={timeZone}
          onClose={onCloseEvent}
        />
      )}
      <DataTable
        table={table}
        layout="auto"
        isStale={search !== deferred}
        empty={
          <DataTableEmpty
            icon={<ListChecksIcon />}
            title={t('device-events.no-events-title')}
            description={t('device-events.no-events-description')}
          />
        }
        footer={sorted.length > 0 && <DataTablePagination table={table} />}
      />
    </>
  );
}
