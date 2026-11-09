import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon, SearchXIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requisitionSearchOptions } from '@/features/requisitions/api/queries';
import { OfflineMarker } from '@/features/requisitions/components/offline-marker';
import { RequisitionCopyNotice } from '@/features/requisitions/components/requisition-copy-notice';
import {
  cardColumns,
  EMERGENCY_COLUMN,
  hideableColumns,
  REQUISITION_LIST_COLUMNS,
  RequisitionListSkeleton,
  RequisitionListTable,
  requisitionListCell,
} from '@/features/requisitions/components/requisition-list-parts';
import { RequisitionRowActions } from '@/features/requisitions/components/requisition-row-actions';
import { useListConnection } from '@/features/requisitions/hooks/use-list-connection';
import {
  RequisitionCopiesContext,
  useOfflineCopies,
} from '@/features/requisitions/hooks/use-offline-copies';
import {
  CLEARED_REQUISITION_FILTERS,
  hasRequisitionFilters,
  REQUISITIONS_PAGE_SIZE,
  REQUISITIONS_SORT,
  type RequisitionSearch,
  toRequisitionQuery,
} from '@/features/requisitions/lib/search-facilities';
import type { RequisitionSearchResult } from '@/features/requisitions/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { tableValue } from '@/lib/empty-value';
import { isDeviceAccess } from '@/lib/offline-access';
import { useOnline } from '@/lib/online';
import { REQUISITION_STATUS } from '@/lib/requisition-status';
import { isSecureOrigin } from '@/lib/secure-context';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const helper = createColumnHelper<DataTableFeatures, RequisitionSearchResult>();
const COLUMNS = [
  ...REQUISITION_LIST_COLUMNS,
  ['createdDate', 'requisitions.columns.date-initiated'],
  ['status', 'requisitions.columns.status'],
  EMERGENCY_COLUMN,
  ['offline', 'requisitions.offline.label'],
] as const;
export const REQUISITION_HIDEABLE_COLUMNS = hideableColumns(
  COLUMNS.filter(([id]) => isSecureOrigin || id !== 'offline'),
);
const CARD_COLUMNS = cardColumns(COLUMNS);
const NO_ROWS: RequisitionSearchResult[] = [];
const noop = () => {};
const rowId = (row: RequisitionSearchResult) => row.id;

type Props = {
  cards: boolean;
  refresh?: number;
  search: RequisitionSearch & { facility: string };
  columns: ColumnVisibilityState;
  onSearchChange: SearchChange<RequisitionSearch>;
};

function useColumns(search: RequisitionSearch, stale: boolean, cards: boolean, timeZone: string) {
  const { t, i18n } = useTranslation();
  return useMemo(
    () =>
      helper.columns([
        ...(cards ? CARD_COLUMNS : COLUMNS)
          .filter(([id]) => isSecureOrigin || id !== 'offline')
          .map(([id, key]) =>
            helper.display({
              id,
              ...(id === 'createdDate' && {
                accessorFn: (record: RequisitionSearchResult) => record.createdDate,
              }),
              meta: { label: t(key) },
              enableSorting: id === 'createdDate',
              sortDescFirst: true,
              header: ({ column }) =>
                id === 'createdDate' ? (
                  <DataTableColumnHeader column={column} title={t(key)} />
                ) : (
                  <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
                ),
              cell: ({ row: { original: record } }) => {
                switch (id) {
                  case 'offline':
                    return <OfflineMarker id={record.id} />;
                  case 'status': {
                    const status = REQUISITION_STATUS[record.status];
                    if (!status) return tableValue(record.status);
                    const Icon = status.icon;
                    return (
                      <Badge variant={status.tone}>
                        <Icon data-icon="inline-start" />
                        {t(status.labelKey)}
                      </Badge>
                    );
                  }
                  default:
                    return requisitionListCell(id, record, i18n.language, timeZone, t);
                }
              },
            }),
          ),
        helper.display({
          id: 'actions',
          meta: { label: t('requisitions.columns.actions'), skeleton: 'control' },
          header: () => (
            <DataTableHeaderLabel>{t('requisitions.columns.actions')}</DataTableHeaderLabel>
          ),
          cell: ({ row }) => (
            <RequisitionRowActions disabled={stale} record={row.original} search={search} />
          ),
        }),
      ]),
    [search, stale, cards, t, i18n.language, timeZone],
  );
}

function useResultsTable(
  {
    cards,
    search,
    columns,
    onSearchChange,
    data,
    rowCount,
    stale,
  }: Omit<Props, 'search'> & {
    search: RequisitionSearch;
    data: RequisitionSearchResult[];
    rowCount: number;
    stale: boolean;
  },
  timeZone: string,
) {
  const defs = useColumns(search, stale, cards, timeZone);
  const { pageStart, searchState } = usePagedTableSearch({
    cards,
    search,
    defaultSort: REQUISITIONS_SORT,
    defaultPageSize: REQUISITIONS_PAGE_SIZE,
    onSearchChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns: defs,
    data,
    getRowId: rowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    ...searchState,
    state: { ...searchState.state, columnVisibility: columns },
  });
  return { table, pageStart };
}

export function RequisitionsTable({ cards, search, columns, onSearchChange, refresh }: Props) {
  const { t } = useTranslation();
  const copies = useOfflineCopies();
  const deferred = useDeferredValue(search);
  const online = useOnline();
  const timeZone = useDeploymentTimeZone();
  const sourceOnline = useListConnection(deferred, refresh);
  const client = useQueryClient();
  const options = requisitionSearchOptions(
    toRequisitionQuery(deferred),
    sourceOnline,
    !!deferred.offline,
    timeZone,
  );
  const retained = !online && sourceOnline && !deferred.offline;
  const { data: page, dataUpdatedAt } = useSuspenseQuery({
    ...options,
    ...(retained && {
      staleTime: Infinity,
      queryFn: () =>
        client.getQueryData(options.queryKey) ??
        client.fetchQuery(
          requisitionSearchOptions(toRequisitionQuery(deferred), false, true, timeZone),
        ),
    }),
  });
  const stale = deferred !== search;
  const { table, pageStart } = useResultsTable(
    {
      cards,
      search: deferred,
      columns,
      onSearchChange,
      data: page.content,
      rowCount: page.totalElements,
      stale,
    },
    timeZone,
  );
  const pastEnd = page.content.length === 0 && page.totalElements > 0;
  useEffect(() => {
    if (pastEnd) onSearchChange({ page: page.totalPages > 1 ? page.totalPages : undefined }, true);
  }, [pastEnd, page.totalPages, onSearchChange]);
  const local = !sourceOnline || !!deferred.offline || isDeviceAccess(page);
  const empty = hasRequisitionFilters({ ...deferred, offline: undefined }) ? (
    <DataTableEmpty
      action={
        <Button variant="destructive" onClick={() => onSearchChange(CLEARED_REQUISITION_FILTERS)}>
          {t('data-table.clear-filters')}
        </Button>
      }
      description={t('requisitions.view.no-matches-description')}
      icon={<SearchXIcon />}
      title={t('requisitions.view.no-matches-title')}
    />
  ) : (
    <DataTableEmpty
      description={t(
        local ? 'requisitions.offline.empty-description' : 'requisitions.view.empty-description',
      )}
      icon={<ClipboardListIcon />}
      title={t(local ? 'requisitions.offline.empty-title' : 'requisitions.view.empty-title')}
    />
  );
  const footer = !pastEnd && page.totalElements > 0 && <DataTablePagination table={table} />;
  return (
    <RequisitionCopiesContext value={copies}>
      <RequisitionCopyNotice
        list
        onlineResultsAt={retained && !isDeviceAccess(page) ? dataUpdatedAt : undefined}
        local={!!deferred.offline || isDeviceAccess(page)}
        ids={page.content.map((record) => record.id)}
      />
      <RequisitionListTable
        cards={cards}
        table={table}
        stale={stale}
        empty={!pastEnd && empty}
        footer={footer}
        listRef={pageStart.ref}
      />
    </RequisitionCopiesContext>
  );
}

export function RequisitionsTableSkeleton({
  cards,
  search,
  columns,
}: Pick<Props, 'cards' | 'columns'> & { search: RequisitionSearch }) {
  const { table } = useResultsTable(
    {
      cards,
      search,
      columns,
      onSearchChange: noop,
      data: NO_ROWS,
      rowCount: 0,
      stale: false,
    },
    'UTC',
  );
  const rowCount = toPaginationState(search, REQUISITIONS_PAGE_SIZE).pageSize;
  return <RequisitionListSkeleton cards={cards} rowCount={rowCount} table={table} />;
}
