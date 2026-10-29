import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon, EyeIcon, SearchXIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions, useInCards } from '@/components/card-actions';
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
import { FlagBadge } from '@/components/flag-badge';
import { formatDateValue, formatTimestamp } from '@/components/form/date-value';
import { TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WrappingCell } from '@/components/wrapping-cell';
import { requisitionSearchOptions } from '@/features/requisitions/api/queries';
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
import { REQUISITION_STATUS } from '@/lib/requisition-status';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const helper = createColumnHelper<DataTableFeatures, RequisitionSearchResult>();
const COLUMNS = [
  ['program', 'requisitions.columns.program'],
  ['facility', 'requisitions.columns.facility'],
  ['period', 'requisitions.columns.period'],
  ['startDate', 'requisitions.columns.start-date'],
  ['endDate', 'requisitions.columns.end-date'],
  ['createdDate', 'requisitions.columns.date-initiated'],
  ['status', 'requisitions.columns.status'],
  ['emergency', 'requisitions.columns.emergency'],
] as const;
export const REQUISITION_HIDEABLE_COLUMNS = COLUMNS.filter(([id]) => id !== 'program').map(
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
  'createdDate',
  'status',
  'emergency',
];
const CARD_COLUMNS = [...COLUMNS].sort(
  ([a], [b]) => CARD_COLUMN_ORDER.indexOf(a) - CARD_COLUMN_ORDER.indexOf(b),
);
const NO_ROWS: RequisitionSearchResult[] = [];
const noop = () => {};
const rowId = (row: RequisitionSearchResult) => row.id;

type Props = {
  cards: boolean;
  search: RequisitionSearch & { facility: string };
  columns: ColumnVisibilityState;
  onSearchChange: SearchChange<RequisitionSearch>;
};

function ViewRequisition({
  record,
  search,
  disabled,
}: {
  record: RequisitionSearchResult;
  search: RequisitionSearch;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const cards = useInCards();
  const name = t('requisitions.view.action-name', {
    program: record.program?.name ?? '',
    period: record.processingPeriod?.name ?? '',
  });
  const link = (
    <Link
      aria-label={name}
      to="/requisitions/view/$requisitionId"
      params={{ requisitionId: record.id }}
      search={search}
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

function useColumns(search: RequisitionSearch, stale: boolean, cards: boolean) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  return useMemo(
    () =>
      helper.columns([
        ...(cards ? CARD_COLUMNS : COLUMNS).map(([id, key]) =>
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
                case 'createdDate':
                  return tableValue(
                    formatTimestamp(record.createdDate, i18n.language, { timeZone }),
                  );
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
    [search, stale, cards, t, i18n.language, timeZone],
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
}: Omit<Props, 'search'> & {
  search: RequisitionSearch;
  data: RequisitionSearchResult[];
  rowCount: number;
  stale: boolean;
}) {
  const defs = useColumns(search, stale, cards);
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

export function RequisitionsTable({ cards, search, columns, onSearchChange }: Props) {
  const { t } = useTranslation();
  const deferred = useDeferredValue(search);
  const { data: page } = useSuspenseQuery(requisitionSearchOptions(toRequisitionQuery(deferred)));
  const stale = deferred !== search;
  const { table, pageStart } = useResultsTable({
    cards,
    search: deferred,
    columns,
    onSearchChange,
    data: page.content,
    rowCount: page.totalElements,
    stale,
  });
  const pastEnd = page.content.length === 0 && page.totalElements > 0;
  useEffect(() => {
    if (pastEnd) onSearchChange({ page: page.totalPages > 1 ? page.totalPages : undefined }, true);
  }, [pastEnd, page.totalPages, onSearchChange]);
  const empty = hasRequisitionFilters(deferred) ? (
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
      description={t('requisitions.view.empty-description')}
      icon={<ClipboardListIcon />}
      title={t('requisitions.view.empty-title')}
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

export function RequisitionsTableSkeleton({
  cards,
  search,
  columns,
}: Pick<Props, 'cards' | 'columns'> & { search: RequisitionSearch }) {
  const { table } = useResultsTable({
    cards,
    search,
    columns,
    onSearchChange: noop,
    data: NO_ROWS,
    rowCount: 0,
    stale: false,
  });
  const rowCount = toPaginationState(search, REQUISITIONS_PAGE_SIZE).pageSize;
  return cards ? (
    <TableCardsSkeleton actions={1} rowCount={rowCount} table={table} title="program" />
  ) : (
    <DataTableSkeleton density="default" layout="auto" rowCount={rowCount} table={table} />
  );
}
