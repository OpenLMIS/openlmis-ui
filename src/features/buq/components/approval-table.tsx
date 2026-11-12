import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper } from '@tanstack/react-table';
import type { ParseKeys, TFunction } from 'i18next';
import { ClipboardCheckIcon, ClipboardListIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { ResponsiveColumn } from '@/components/data-table/responsive-columns';
import { CardActions, useInCards } from '@/components/display/card-actions';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { formatTimestamp } from '@/components/form/date-value';
import { Button } from '@/components/ui/button';
import { buqsForApprovalOptions } from '@/features/buq/api/queries';
import { useBuqPeriods } from '@/features/buq/components/use-buq-periods';
import { useBuqTable } from '@/features/buq/components/use-buq-table';
import {
  type ApprovalRow,
  approvalFacilityIds,
  approvalRows,
} from '@/features/buq/lib/approval-rows';
import type { BuqListSearch, BuqTableProps } from '@/features/buq/lib/search';
import { facilitiesByIdsOptions } from '@/features/reference-data/api/queries';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';

const columnHelper = createColumnHelper<DataTableFeatures, ApprovalRow>();

export const APPROVAL_HIDEABLE_COLUMNS: readonly (ResponsiveColumn & { labelKey: ParseKeys })[] = [
  { id: 'facilityType', labelKey: 'buq.approve.facility-type', hideBelow: 864 },
  { id: 'district', labelKey: 'buq.approve.district', hideBelow: '3xl' },
  { id: 'region', labelKey: 'buq.approve.region', hideBelow: 960 },
];

type TextColumn = Exclude<keyof ApprovalRow, 'id' | 'submittedAt'>;

function ReviewAction({ row, listSearch }: { row: ApprovalRow; listSearch: BuqListSearch }) {
  const { t } = useTranslation();
  const cards = useInCards();
  const link = (
    <Link params={{ id: row.id }} state={{ buqListSearch: listSearch }} to="/buq/approve/$id" />
  );
  const names = { facility: row.facilityName, period: row.periodName };
  const name = t('buq.approve.review-label', names);
  if (cards) {
    return (
      <CardActions
        actions={[
          {
            id: 'review',
            icon: <ClipboardListIcon />,
            label: t('buq.approve.review'),
            name,
            link,
          },
        ]}
        label={t('buq.approve.actions-for', names)}
      />
    );
  }
  return (
    <Button aria-label={name} nativeButton={false} render={link} size="sm">
      {t('buq.approve.review')}
    </Button>
  );
}

function createColumns(
  t: TFunction,
  locale: string,
  timeZone: string | undefined,
  listSearch: BuqListSearch,
) {
  const textColumn = (id: TextColumn, label: ParseKeys, className?: string) =>
    columnHelper.accessor(id, {
      header: t(label),
      cell: ({ getValue }) =>
        getValue() && (
          <CellText overflow="clamp">
            <bdi>{getValue()}</bdi>
          </CellText>
        ),
      meta: { label: t(label), className },
    });
  return columnHelper.columns([
    textColumn('facilityCode', 'buq.approve.facility-code', 'w-36'),
    textColumn('facilityName', 'buq.approve.facility-name', '@4xl/main:w-1/5'),
    textColumn('facilityType', 'buq.approve.facility-type'),
    textColumn('district', 'buq.approve.district'),
    textColumn('region', 'buq.approve.region'),
    textColumn('periodName', 'buq.approve.period', '@4xl/main:w-48'),
    columnHelper.accessor('submittedAt', {
      header: t('buq.approve.submitted'),
      cell: ({ getValue }) => formatTimestamp(getValue(), locale, { timeZone }),
      meta: { label: t('buq.approve.submitted'), className: 'w-36' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <DataTableHeaderLabel>{t('buq.approve.actions')}</DataTableHeaderLabel>,
      cell: ({ row }) => <ReviewAction listSearch={listSearch} row={row.original} />,
      meta: { className: 'w-28', skeleton: 'control' },
    }),
  ]);
}

const NO_ROWS: ApprovalRow[] = [];
const noop = () => {};

type ApprovalTableProps = BuqTableProps & { visibility: ColumnVisibilityState };

function useApprovalTable(
  rows: readonly ApprovalRow[],
  { visibility, ...props }: ApprovalTableProps,
  timeZone?: string,
) {
  const { t, i18n } = useTranslation();
  const columns = useMemo(
    () => createColumns(t, i18n.language, timeZone, props.search),
    [t, i18n.language, timeZone, props.search],
  );
  return useBuqTable(rows, columns, props, visibility);
}

export function ApprovalTableSkeleton({
  cards,
  ...props
}: Pick<ApprovalTableProps, 'cards' | 'search' | 'visibility'>) {
  const { table } = useApprovalTable(NO_ROWS, { ...props, onSearchChange: noop, cards: false });
  if (cards) {
    return <TableCardsSkeleton actions={1} rowCount={1} table={table} title="facilityName" />;
  }
  return <DataTableSkeleton rowCount={1} table={table} />;
}

export function ApprovalTable({ programId, ...props }: ApprovalTableProps & { programId: string }) {
  const { t } = useTranslation();
  const { data: buqs } = useSuspenseQuery(buqsForApprovalOptions(programId));
  const facilityIds = useMemo(() => approvalFacilityIds(buqs), [buqs]);
  const { data: facilities } = useSuspenseQuery(facilitiesByIdsOptions(facilityIds));
  const periods = useBuqPeriods();
  const timeZone = useDeploymentTimeZone();
  const rows = useMemo(() => approvalRows(buqs, facilities, periods), [buqs, facilities, periods]);
  const { table, pageStart, isPastLastPage } = useApprovalTable(rows, props, timeZone);
  const footer = !isPastLastPage && rows.length > 0 && <DataTablePagination table={table} />;
  const empty = !isPastLastPage && (
    <DataTableEmpty
      description={t('buq.approve.empty-description')}
      icon={<ClipboardCheckIcon />}
      title={t('buq.empty')}
    />
  );
  if (props.cards) {
    return (
      <TableCards
        empty={empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="facilityName"
      />
    );
  }
  return <DataTable empty={empty} footer={footer} table={table} />;
}
