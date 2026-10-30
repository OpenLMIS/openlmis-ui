import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  type ColumnVisibilityState,
  createColumnHelper,
  functionalUpdate,
  useTable,
} from '@tanstack/react-table';
import { ClipboardListIcon, EyeIcon, SearchXIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { selectionColumn } from '@/components/data-table/data-table-selection';
import { CardActions, useInCards } from '@/components/display/card-actions';
import { TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { WrappingCell } from '@/components/display/wrapping-cell';
import { formatDateValue, formatTimestamp } from '@/components/form/date-value';
import { FlagBadge } from '@/components/shared/flag-badge';
import { Button } from '@/components/ui/button';
import { approvalListOptions } from '@/features/requisitions/api/queries';
import {
  APPROVAL_SORT,
  type ApprovalSearch,
  type ApprovalSelection,
  approvalScope,
} from '@/features/requisitions/lib/approval-search';
import { approvalReturnState } from '@/features/requisitions/lib/initiate-search';
import type { ApprovalListRow } from '@/features/requisitions/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { tableValue } from '@/lib/empty-value';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const helper = createColumnHelper<DataTableFeatures, ApprovalListRow>();
const COLUMNS = [
  ['program', 'requisitions.columns.program'],
  ['facility', 'requisitions.columns.facility'],
  ['period', 'requisitions.columns.period'],
  ['startDate', 'requisitions.columns.start-date'],
  ['endDate', 'requisitions.columns.end-date'],
  ['submittedDate', 'requisitions.approve.date-submitted'],
  ['authorizedDate', 'requisitions.approve.date-authorized'],
  ['emergency', 'requisitions.columns.emergency'],
] as const;
export const APPROVAL_HIDEABLE_COLUMNS = COLUMNS.filter(([id]) => id !== 'program').map(
  ([id, labelKey]) => ({
    id,
    labelKey,
    ...((id === 'startDate' || id === 'endDate') && { hideBelow: 1024 }),
  }),
);
const CARD_COLUMN_ORDER = [
  'program',
  'period',
  'facility',
  'startDate',
  'endDate',
  'submittedDate',
  'authorizedDate',
  'emergency',
];
const CARD_COLUMNS = [...COLUMNS].sort(
  ([a], [b]) => CARD_COLUMN_ORDER.indexOf(a) - CARD_COLUMN_ORDER.indexOf(b),
);
const NO_ROWS: ApprovalListRow[] = [];
const noop = () => {};
const rowId = (row: ApprovalListRow) => row.id;
export const approvalRowLabel = (row: ApprovalListRow) =>
  [
    row.program?.name,
    row.facility?.code,
    row.facility?.name,
    row.processingPeriod?.name,
    row.emergency ? '!' : '',
  ]
    .filter(Boolean)
    .join(' - ');

type Props = {
  cards: boolean;
  search: ApprovalSearch;
  batch?: boolean;
  picked?: ApprovalSelection;
  onSelection?: (next: ApprovalSelection, scope: string) => void;
  columns: ColumnVisibilityState;
  onSearchChange: SearchChange<ApprovalSearch>;
};

function ViewRequisition({
  record,
  search,
  disabled,
}: {
  record: ApprovalListRow;
  search: ApprovalSearch;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const cards = useInCards();
  const name = t('requisitions.view.action-name', {
    program: record.program?.name ?? '',
    period: [record.processingPeriod?.name, record.facility?.code, record.facility?.name]
      .filter(Boolean)
      .join(' - '),
  });
  const link = (
    <Link
      aria-label={name}
      to="/requisitions/view/$requisitionId"
      params={{ requisitionId: record.id }}
      state={approvalReturnState(search)}
    />
  );
  if (cards)
    return (
      <CardActions
        label={t('card-actions.actions-for', {
          name: [record.program?.name, record.processingPeriod?.name].filter(Boolean).join(' - '),
        })}
        actions={[
          {
            id: 'view',
            icon: <EyeIcon />,
            label: t('requisitions.view.action'),
            name,
            link,
            disabled,
          },
        ]}
      />
    );
  return (
    <Button aria-label={name} disabled={disabled} nativeButton={false} render={link} size="sm">
      {t('requisitions.view.action')}
    </Button>
  );
}

function useColumns(search: ApprovalSearch, stale: boolean, cards: boolean, batch = false) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  return useMemo(
    () =>
      helper.columns([
        ...(batch ? [selectionColumn<ApprovalListRow>(approvalRowLabel)] : []),
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
            cell: ({ row: { original: record } }) => {
              switch (id) {
                case 'program':
                  return tableValue(record.program?.name) ? (
                    <WrappingCell width="bounded">{record.program?.name}</WrappingCell>
                  ) : null;
                case 'facility':
                  return (
                    record.facility && (
                      <WrappingCell width="bounded">
                        {[record.facility.code, record.facility.name].filter(Boolean).join(' - ')}
                      </WrappingCell>
                    )
                  );
                case 'period':
                  return tableValue(record.processingPeriod?.name);
                case 'startDate':
                  return tableValue(
                    formatDateValue(record.processingPeriod?.startDate ?? '', i18n.language),
                  );
                case 'endDate':
                  return tableValue(
                    formatDateValue(record.processingPeriod?.endDate ?? '', i18n.language),
                  );
                case 'submittedDate':
                case 'authorizedDate':
                  return record.extraData?.originalRequisition
                    ? t('requisitions.approve.not-applicable')
                    : tableValue(
                        formatTimestamp(
                          record.statusChanges?.[
                            id === 'submittedDate' ? 'SUBMITTED' : 'AUTHORIZED'
                          ]?.changeDate,
                          i18n.language,
                          { timeZone },
                        ),
                      );
                case 'emergency':
                  return (
                    <FlagBadge
                      value={record.emergency}
                      trueLabel={t('requisitions.yes')}
                      falseLabel={t('requisitions.no')}
                    />
                  );
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
            <ViewRequisition disabled={stale} record={row.original} search={search} />
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
}: Omit<Props, 'search'> & {
  search: ApprovalSearch;
  data: ApprovalListRow[];
  rowCount: number;
  stale: boolean;
}) {
  const defs = useColumns(search, stale, cards, batch);
  const { pageStart, searchState } = usePagedTableSearch({
    cards,
    search,
    defaultSort: APPROVAL_SORT,
    defaultPageSize: 20,
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
      rowSelection: Object.fromEntries([...(picked?.keys() ?? [])].map((id) => [id, true])),
    },
    onRowSelectionChange: (updater) => {
      if (!onSelection || stale) return;
      const selected = functionalUpdate(
        updater,
        Object.fromEntries([...(picked?.keys() ?? [])].map((id) => [id, true])),
      );
      const visible = new Map(
        data.map((row) => [row.id, { programId: row.program.id, label: approvalRowLabel(row) }]),
      );
      onSelection(
        new Map(
          Object.entries(selected).flatMap(([id, chosen]) => {
            const value = visible.get(id) ?? picked?.get(id);
            return chosen && value ? [[id, value] as const] : [];
          }),
        ),
        approvalScope(search),
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
  const deferred = useDeferredValue(search);
  const { data: page } = useSuspenseQuery(approvalListOptions(deferred));
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
  const empty = deferred.program ? (
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
      description={t('requisitions.approve.description')}
      icon={<ClipboardListIcon />}
      title={t('requisitions.approve.empty')}
    />
  );
  const footer = !pastEnd && page.totalElements > 0 && <DataTablePagination table={table} />;
  return cards ? (
    <TableCards
      busy={stale}
      empty={!pastEnd && empty}
      footer={footer}
      listRef={pageStart.ref}
      table={table}
      title="program"
    />
  ) : (
    <DataTable
      density="default"
      empty={!pastEnd && empty}
      footer={footer}
      isStale={stale}
      layout="auto"
      table={table}
    />
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
  const rowCount = toPaginationState(search, 20).pageSize;
  return cards ? (
    <TableCardsSkeleton actions={1} rowCount={rowCount} table={table} title="program" />
  ) : (
    <DataTableSkeleton density="default" layout="auto" rowCount={rowCount} table={table} />
  );
}
