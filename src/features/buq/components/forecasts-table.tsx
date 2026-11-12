import { Link } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { ArrowRightIcon, FilePenLineIcon } from 'lucide-react';
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
import { CardActions, useInCards } from '@/components/display/card-actions';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { Button } from '@/components/ui/button';
import { buqStatusBadge } from '@/features/buq/components/buq-status-badge';
import { useBuqTable } from '@/features/buq/components/use-buq-table';
import { type ForecastRights, forecastActions } from '@/features/buq/lib/forecast-actions';
import { type BuqRow, buqRows, quantificationYears } from '@/features/buq/lib/rows';
import type { BuqListSearch, BuqTableProps } from '@/features/buq/lib/search';
import type { Buq, BuqPeriod } from '@/features/buq/lib/types';

const columnHelper = createColumnHelper<DataTableFeatures, BuqRow>();

type RowActionContext = {
  rights: ForecastRights;
  skipAuthorization: boolean;
  listSearch: BuqListSearch;
};

const NO_ACTIONS: RowActionContext = {
  rights: { create: false, authorize: false },
  skipAuthorization: false,
  listSearch: {},
};

function ForecastRowAction({ row, context }: { row: BuqRow; context: RowActionContext }) {
  const { t } = useTranslation();
  const cards = useInCards();
  if (!forecastActions(row.status, context.rights, context.skipAuthorization).length) return null;
  const link = (
    <Link
      params={{ id: row.id }}
      state={{ buqListSearch: context.listSearch }}
      to="/buq/create/$id"
    />
  );
  const name = t('buq.create.forecast-label', { period: row.periodName });
  if (cards) {
    return (
      <CardActions
        actions={[
          {
            id: 'forecast',
            icon: <ArrowRightIcon className="rtl:rotate-180" />,
            label: t('buq.create.forecast'),
            name,
            link,
          },
        ]}
        label={t('buq.create.actions-for', { period: row.periodName })}
      />
    );
  }
  return (
    <Button aria-label={name} nativeButton={false} render={link} size="sm">
      {t('buq.create.forecast')}
    </Button>
  );
}

function createColumns(t: TFunction, context: RowActionContext) {
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
      cell: ({ getValue }) => buqStatusBadge(t, getValue()),
      meta: { label: t('buq.create.status') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <DataTableHeaderLabel>{t('buq.create.actions')}</DataTableHeaderLabel>,
      cell: ({ row }) => <ForecastRowAction context={context} row={row.original} />,
      meta: { className: 'w-28', skeleton: 'control' },
    }),
  ]);
}

const NO_ROWS: BuqRow[] = [];
const noop = () => {};

function useForecastsTable(
  rows: readonly BuqRow[],
  context: RowActionContext,
  props: BuqTableProps,
) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, context), [t, context]);
  return useBuqTable(rows, columns, props);
}

export function ForecastsTableSkeleton({
  cards,
  search,
}: {
  cards: boolean;
  search: BuqListSearch;
}) {
  const { table } = useForecastsTable(NO_ROWS, NO_ACTIONS, {
    search,
    onSearchChange: noop,
    cards: false,
  });
  if (cards) {
    return <TableCardsSkeleton actions={1} rowCount={1} table={table} title="periodName" />;
  }
  return <DataTableSkeleton rowCount={1} table={table} />;
}

export function ForecastsTable({
  buqs,
  periods,
  rights,
  skipAuthorization,
  ...props
}: BuqTableProps & {
  buqs: readonly Buq[];
  periods: readonly BuqPeriod[];
  rights: ForecastRights;
  skipAuthorization: boolean;
}) {
  const { t } = useTranslation();
  const rows = useMemo(() => buqRows(buqs, periods), [buqs, periods]);
  const context = useMemo(
    () => ({ rights, skipAuthorization, listSearch: props.search }),
    [rights, skipAuthorization, props.search],
  );
  const { table, pageStart, isPastLastPage } = useForecastsTable(rows, context, props);
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
