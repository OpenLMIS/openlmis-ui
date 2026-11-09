import { useSuspenseQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { ClipboardCheckIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { formatTimestamp } from '@/components/form/date-value';
import { buqsForApprovalOptions } from '@/features/buq/api/queries';
import { useBuqPeriods } from '@/features/buq/components/use-buq-periods';
import { useBuqTable } from '@/features/buq/components/use-buq-table';
import { type ApprovalRow, approvalRows } from '@/features/buq/lib/approval-rows';
import type { BuqListSearch, BuqTableProps } from '@/features/buq/lib/search';
import { facilitiesByIdsOptions } from '@/features/reference-data/api/queries';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';

const columnHelper = createColumnHelper<DataTableFeatures, ApprovalRow>();

const text = (value: string) => (
  <CellText overflow="clamp">
    <bdi>{value}</bdi>
  </CellText>
);

function createColumns(t: TFunction, locale: string, timeZone: string | undefined) {
  return columnHelper.columns([
    columnHelper.accessor('facilityCode', {
      header: t('buq.approve.facility-code'),
      cell: ({ getValue }) => getValue(),
      meta: { label: t('buq.approve.facility-code'), className: 'w-28' },
    }),
    columnHelper.accessor('facilityName', {
      header: t('buq.approve.facility-name'),
      cell: ({ getValue }) => text(getValue()),
      meta: { label: t('buq.approve.facility-name') },
    }),
    columnHelper.accessor('facilityType', {
      header: t('buq.approve.facility-type'),
      cell: ({ getValue }) => text(getValue()),
      meta: { label: t('buq.approve.facility-type') },
    }),
    columnHelper.accessor('district', {
      header: t('buq.approve.district'),
      cell: ({ getValue }) => text(getValue()),
      meta: { label: t('buq.approve.district') },
    }),
    columnHelper.accessor('region', {
      header: t('buq.approve.region'),
      cell: ({ getValue }) => text(getValue()),
      meta: { label: t('buq.approve.region') },
    }),
    columnHelper.accessor('periodName', {
      header: t('buq.approve.period'),
      cell: ({ getValue }) => text(getValue()),
      meta: { label: t('buq.approve.period') },
    }),
    columnHelper.accessor('submittedAt', {
      header: t('buq.approve.submitted'),
      cell: ({ getValue }) => formatTimestamp(getValue(), locale, { timeZone }),
      meta: { label: t('buq.approve.submitted'), className: 'w-36' },
    }),
  ]);
}

const NO_ROWS: ApprovalRow[] = [];
const noop = () => {};

function useApprovalTable(rows: readonly ApprovalRow[], props: BuqTableProps, timeZone?: string) {
  const { t, i18n } = useTranslation();
  const columns = useMemo(
    () => createColumns(t, i18n.language, timeZone),
    [t, i18n.language, timeZone],
  );
  return useBuqTable(rows, columns, props);
}

export function ApprovalTableSkeleton({
  cards,
  search,
}: {
  cards: boolean;
  search: BuqListSearch;
}) {
  const { table } = useApprovalTable(NO_ROWS, { search, onSearchChange: noop, cards: false });
  if (cards) return <TableCardsSkeleton rowCount={1} table={table} title="facilityName" />;
  return <DataTableSkeleton rowCount={1} table={table} />;
}

export function ApprovalTable({ programId, ...props }: BuqTableProps & { programId: string }) {
  const { t } = useTranslation();
  const { data: buqs } = useSuspenseQuery(buqsForApprovalOptions(programId));
  const facilityIds = useMemo(
    () => [...new Set(buqs.map(({ facilityId }) => facilityId))].toSorted(),
    [buqs],
  );
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
