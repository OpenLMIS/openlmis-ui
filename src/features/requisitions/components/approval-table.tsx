import { useSuspenseQuery } from '@tanstack/react-query';
import {
  type ColumnVisibilityState,
  createColumnHelper,
  functionalUpdate,
  useTable,
} from '@tanstack/react-table';
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
import { selectionColumn } from '@/components/data-table/data-table-selection';
import { Button } from '@/components/ui/button';
import { approvalListOptions } from '@/features/requisitions/api/queries';
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
  requisitionRowLabel,
  ViewRequisition,
} from '@/features/requisitions/components/requisition-list-parts';
import {
  RequisitionCopiesContext,
  useOfflineCopies,
} from '@/features/requisitions/hooks/use-offline-copies';
import {
  APPROVAL_SORT,
  type ApprovalSearch,
  type ApprovalSelection,
  approvalRowIndex,
  approvalScope,
} from '@/features/requisitions/lib/approval-search';
import { returnState } from '@/features/requisitions/lib/requisition-return';
import type { ApprovalListRow } from '@/features/requisitions/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { isDeviceAccess } from '@/lib/offline-access';
import { useOnline } from '@/lib/online';
import { isSecureOrigin } from '@/lib/secure-context';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const helper = createColumnHelper<DataTableFeatures, ApprovalListRow>();
const COLUMNS = [
  ...REQUISITION_LIST_COLUMNS,
  ['submittedDate', 'requisitions.approve.date-submitted'],
  ['authorizedDate', 'requisitions.approve.date-authorized'],
  EMERGENCY_COLUMN,
  ...(isSecureOrigin ? [['offline', 'requisitions.offline.label'] as const] : []),
] as const;
export const APPROVAL_HIDEABLE_COLUMNS = hideableColumns(COLUMNS);
const CARD_COLUMNS = cardColumns(COLUMNS);
const NO_ROWS: ApprovalListRow[] = [];
const noop = () => {};
const rowId = (row: ApprovalListRow) => row.id;

type Props = {
  cards: boolean;
  search: ApprovalSearch;
  batch?: boolean;
  picked?: ApprovalSelection;
  onSelection?: (next: ApprovalSelection, scope: string) => void;
  columns: ColumnVisibilityState;
  onSearchChange: SearchChange<ApprovalSearch>;
};

function useColumns(search: ApprovalSearch, stale: boolean, cards: boolean, batch = false) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  return useMemo(
    () =>
      helper.columns([
        ...(batch
          ? [
              selectionColumn<ApprovalListRow>((row) =>
                requisitionRowLabel(row, t('requisitions.columns.emergency')),
              ),
            ]
          : []),
        ...(cards ? CARD_COLUMNS : COLUMNS).map(([id, key]) =>
          helper.display({
            id,
            ...(id === 'authorizedDate' && {
              accessorFn: (record: ApprovalListRow) => record.statusChanges?.AUTHORIZED?.changeDate,
            }),
            meta: { label: t(key) },
            enableSorting: id === 'authorizedDate',
            sortDescFirst: true,
            header: ({ column }) =>
              id === 'authorizedDate' ? (
                <DataTableColumnHeader column={column} title={t(key)} />
              ) : (
                <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
              ),
            cell: ({ row: { original: record } }) =>
              id === 'offline' ? (
                <OfflineMarker id={record.id} />
              ) : (
                requisitionListCell(id, record, i18n.language, timeZone, t)
              ),
          }),
        ),
        helper.display({
          id: 'actions',
          meta: { label: t('requisitions.columns.actions'), skeleton: 'control' },
          header: () => (
            <DataTableHeaderLabel>{t('requisitions.columns.actions')}</DataTableHeaderLabel>
          ),
          cell: ({ row }) => (
            <ViewRequisition
              disabled={stale}
              record={row.original}
              includeFacility
              linkProps={{ state: returnState({ to: '/requisitions/approve', search }) }}
            />
          ),
        }),
      ]),
    [search, stale, cards, batch, t, i18n.language, timeZone],
  );
}

function useResultsTable({
  cards,
  search,
  columns,
  onSearchChange,
  data,
  rowCount,
  stale,
  batch,
  picked,
  onSelection,
}: Props & {
  data: ApprovalListRow[];
  rowCount: number;
  stale: boolean;
}) {
  const { t } = useTranslation();
  const online = useOnline();
  const rowSelection = Object.fromEntries(
    [...(picked?.keys() ?? [])].map((id) => [id, true as const]),
  );
  const defs = useColumns(search, stale, cards, batch);
  const { pageStart, searchState } = usePagedTableSearch({
    cards,
    search,
    defaultSort: APPROVAL_SORT,
    defaultPageSize: 10,
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
    enableRowSelection: !stale,
    state: {
      ...searchState.state,
      columnVisibility: columns,
      rowSelection,
    },
    onRowSelectionChange: (updater) => {
      if (!onSelection || stale) return;
      const selected = functionalUpdate(updater, rowSelection);
      const visible = new Map(
        data.map((row, index) => [
          row.id,
          {
            record: row,
            programId: row.program.id,
            rowIndex: approvalRowIndex(search, index),
            label: requisitionRowLabel(row, t('requisitions.columns.emergency')),
          },
        ]),
      );
      onSelection(
        new Map(
          Object.entries(selected).flatMap(([id, chosen]) => {
            const value = visible.get(id) ?? picked?.get(id);
            return chosen && value ? [[id, value] as const] : [];
          }),
        ),
        approvalScope(search, online),
      );
    },
  });
  return { table, pageStart };
}

export function ApprovalTable({
  cards,
  search,
  columns,
  onSearchChange,
  batch,
  picked,
  onSelection,
}: Props) {
  const { t } = useTranslation();
  const copies = useOfflineCopies();
  const deferred = useDeferredValue(search);
  const online = useOnline();
  const { data: page } = useSuspenseQuery(approvalListOptions(deferred, online));
  const stale = deferred !== search;
  const { table, pageStart } = useResultsTable({
    cards,
    search: deferred,
    columns,
    onSearchChange,
    data: page.content,
    rowCount: page.totalElements,
    stale,
    batch,
    picked,
    onSelection,
  });
  const pastEnd = page.content.length === 0 && (deferred.page ?? 1) > Math.max(1, page.totalPages);
  useEffect(() => {
    if (pastEnd) onSearchChange({ page: page.totalPages > 1 ? page.totalPages : undefined }, true);
  }, [pastEnd, page.totalPages, onSearchChange]);
  const local = !online || !!deferred.offline || isDeviceAccess(page);
  const empty =
    local && !deferred.program ? (
      <DataTableEmpty
        title={t('requisitions.filters.program')}
        description={t('requisitions.offline.choose-program')}
      />
    ) : local ? (
      <DataTableEmpty
        description={t(
          copies?.length
            ? 'requisitions.view.no-matches-description'
            : 'requisitions.offline.empty-description',
        )}
        icon={copies?.length ? <SearchXIcon /> : <ClipboardListIcon />}
        title={t(
          copies?.length
            ? 'requisitions.view.no-matches-title'
            : 'requisitions.offline.empty-title',
        )}
      />
    ) : deferred.program ? (
      <DataTableEmpty
        action={
          <Button
            variant="destructive"
            onClick={() => onSearchChange({ program: undefined, page: undefined })}
          >
            {t('data-table.clear-filters')}
          </Button>
        }
        description={t('requisitions.view.no-matches-description')}
        icon={<SearchXIcon />}
        title={t('requisitions.view.no-matches-title')}
      />
    ) : (
      <DataTableEmpty
        description={t('requisitions.approve.empty-description')}
        icon={<ClipboardListIcon />}
        title={t('requisitions.approve.empty')}
      />
    );
  const footer = !pastEnd && page.totalElements > 0 && <DataTablePagination table={table} />;
  return (
    <RequisitionCopiesContext value={copies}>
      <RequisitionCopyNotice
        list
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

export function ApprovalTableSkeleton({
  cards,
  search,
  columns,
  batch,
}: Pick<Props, 'cards' | 'columns' | 'batch'> & { search: ApprovalSearch }) {
  const { table } = useResultsTable({
    cards,
    search,
    columns,
    onSearchChange: noop,
    data: NO_ROWS,
    rowCount: 0,
    stale: false,
    batch,
  });
  const rowCount = toPaginationState(search, 10).pageSize;
  return <RequisitionListSkeleton cards={cards} rowCount={rowCount} table={table} />;
}
