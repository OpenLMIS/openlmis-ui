import { type ColumnDef, useTable } from '@tanstack/react-table';
import { ClockIcon, ListChecksIcon } from 'lucide-react';
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
import { formatTimestamp } from '@/components/form/date-value';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Badge } from '@/components/ui/badge';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { useDeviceEvents } from '@/features/stock-events/hooks/use-device-events';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { useStoredState } from '@/hooks/use-stored-state';
import {
  type SearchChange,
  type TableSearch,
  tableSearchSchema,
  toPaginationState,
  useTableSearchState,
} from '@/lib/table-search';

export const deviceEventsSearchSchema = tableSearchSchema(['queuedAt']).pick({
  page: true,
  size: true,
  sort: true,
  dir: true,
});
const choicesSchema = z.record(z.string(), z.boolean());
const hideable = [
  { id: 'program', labelKey: 'facility-program.program', hideBelow: 'xl' },
  { id: 'lots', labelKey: 'lots.title', hideBelow: '2xl' },
  { id: 'kind', labelKey: 'device-events.type', hideBelow: 'xl' },
  { id: 'queuedAt', labelKey: 'device-events.queued-at', hideBelow: '3xl' },
  { id: 'status', labelKey: 'device-events.status', hideBelow: '2xl' },
] as const;
const kindLabels = {
  adjustment: 'nav.stock-management.adjustments',
  issue: 'nav.stock-management.issue',
  receive: 'nav.stock-management.receive',
  unpack: 'nav.stock-management.unpack',
} as const;
const defaultSort = { id: 'queuedAt', desc: false };

export function DeviceEventsPage({
  search,
  onSearchChange,
}: {
  search: TableSearch;
  onSearchChange: SearchChange<TableSearch>;
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
          <WorkspaceDescription>{t('device-events.description')}</WorkspaceDescription>
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
                search={search}
                onSearchChange={onSearchChange}
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
              search={search}
              onSearchChange={onSearchChange}
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
  columnVisibility,
  timeZone,
  loading = false,
}: {
  search: TableSearch;
  onSearchChange: SearchChange<TableSearch>;
  columnVisibility: Record<string, boolean>;
  timeZone?: string;
  loading?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const local = useDeviceEvents(!loading);
  const deferred = useDeferredValue(search);
  const columns = useMemo<ColumnDef<DataTableFeatures, QueuedStockEvent>[]>(
    () => [
      {
        accessorKey: 'kind',
        header: t('device-events.type'),
        cell: ({ row }) => t(kindLabels[row.original.kind]),
        meta: { className: 'w-32' },
      },
      {
        id: 'facility',
        header: t('facility-program.facility'),
        cell: ({ row }) => (
          <span dir="auto">{row.original.facility.name || row.original.facility.code}</span>
        ),
      },
      {
        id: 'program',
        header: t('facility-program.program'),
        cell: ({ row }) => (
          <span dir="auto">{row.original.program.name || row.original.program.code}</span>
        ),
      },
      {
        id: 'products',
        header: t('stock-events.product'),
        cell: ({ row }) => (
          <div className="flex min-w-48 flex-col gap-1">
            {row.original.lines.map((line) => (
              <span key={line.key} dir="auto">
                {line.orderable.fullProductName || line.orderable.productCode}
              </span>
            ))}
          </div>
        ),
      },
      {
        id: 'lots',
        header: t('lots.title'),
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            {row.original.lines.map((line) => (
              <span key={line.key} dir="auto">
                {line.lot?.lotCode}
              </span>
            ))}
          </div>
        ),
      },
      {
        accessorKey: 'queuedAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('device-events.queued-at')} />
        ),
        cell: ({ row }) => (
          <time dateTime={new Date(row.original.queuedAt).toISOString()}>
            <span className="block whitespace-normal">
              {formatTimestamp(new Date(row.original.queuedAt).toISOString(), i18n.language, {
                time: true,
                timeZone,
              })}
            </span>
          </time>
        ),
      },
      {
        accessorKey: 'status',
        header: t('device-events.status'),
        cell: ({ row }) => (
          <Badge variant="secondary">
            <ClockIcon data-icon="inline-start" />
            {t(`device-events.status-${row.original.status}`)}
          </Badge>
        ),
        meta: { className: 'w-36' },
      },
    ],
    [t, i18n.language, timeZone],
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
      sorted.slice(
        pagination.pageIndex * pagination.pageSize,
        (pagination.pageIndex + 1) * pagination.pageSize,
      ),
    [sorted, pagination.pageIndex, pagination.pageSize],
  );
  const searchState = useTableSearchState({ search: deferred, defaultSort, onSearchChange });
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
    <DataTable
      table={table}
      layout="auto"
      isStale={search !== deferred}
      empty={
        <DataTableEmpty
          icon={<ListChecksIcon />}
          title={t('device-events.empty-title')}
          description={t('device-events.empty-description')}
        />
      }
      footer={sorted.length > 0 && <DataTablePagination table={table} />}
    />
  );
}
