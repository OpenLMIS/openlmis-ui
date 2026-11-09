import { createColumnHelper } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { FilePenLineIcon } from 'lucide-react';
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
import { BuqStatusBadge } from '@/features/buq/components/buq-status-badge';
import { type BuqTableProps, useBuqTable } from '@/features/buq/components/use-buq-table';
import { BUQ_STATUS } from '@/features/buq/lib/buq-status';
import { type BuqRow, buqRows, quantificationYears } from '@/features/buq/lib/rows';
import type { BuqListSearch } from '@/features/buq/lib/search';
import type { Buq, BuqPeriod } from '@/features/buq/lib/types';

const columnHelper = createColumnHelper<DataTableFeatures, BuqRow>();

function createColumns(t: TFunction) {
  return columnHelper.columns([
    columnHelper.accessor('periodName', {
      header: t('buq.create.period'),
      cell: ({ getValue }) => <CellText overflow="clamp">{getValue()}</CellText>,
      meta: { label: t('buq.create.period') },
    }),
    columnHelper.accessor('targetYear', {
      header: t('buq.create.quantification-year'),
      cell: ({ getValue }) => quantificationYears(getValue()),
      meta: { label: t('buq.create.quantification-year') },
    }),
    columnHelper.accessor('status', {
      header: t('buq.create.status'),
      cell: ({ getValue }) => (
        <BuqStatusBadge label={t(BUQ_STATUS[getValue()].labelKey)} status={getValue()} />
      ),
      meta: { label: t('buq.create.status') },
    }),
  ]);
}

const NO_ROWS: BuqRow[] = [];
const noop = () => {};

function useForecastsTable(rows: readonly BuqRow[], props: BuqTableProps) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t), [t]);
  return useBuqTable(rows, columns, props);
}

export function ForecastsTableSkeleton({
  cards,
  search,
}: {
  cards: boolean;
  search: BuqListSearch;
}) {
  const { table } = useForecastsTable(NO_ROWS, { search, onSearchChange: noop, cards: false });
  if (cards) return <TableCardsSkeleton rowCount={1} table={table} title="periodName" />;
  return <DataTableSkeleton rowCount={1} table={table} />;
}

export function ForecastsTable({
  buqs,
  periods,
  ...props
}: BuqTableProps & { buqs: readonly Buq[]; periods: readonly BuqPeriod[] }) {
  const { t } = useTranslation();
  const rows = useMemo(() => buqRows(buqs, periods), [buqs, periods]);
  const { table, pageStart, isPastLastPage } = useForecastsTable(rows, props);
  const footer = !isPastLastPage && rows.length > 0 && <DataTablePagination table={table} />;
  const empty = !isPastLastPage && (
    <DataTableEmpty
      description={t('buq.create.empty-description')}
      icon={<FilePenLineIcon />}
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
        title="periodName"
      />
    );
  }
  return <DataTable empty={empty} footer={footer} table={table} />;
}
