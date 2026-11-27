import { useSuspenseQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { ChartNoAxesCombinedIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
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
import { RowActions } from '@/components/display/card-actions';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { FlagBadge } from '@/components/shared/flag-badge';
import { Button } from '@/components/ui/button';
import { dashboardReportsAdminOptions } from '@/features/dashboard-reports/api/queries';
import { pageOfDashboardReports } from '@/features/dashboard-reports/lib/reports-list';
import {
  type DashboardReportsSearch,
  DEFAULT_DASHBOARD_REPORTS_SORT,
} from '@/features/dashboard-reports/lib/search';
import {
  type ManagedDashboardReport,
  REPORT_TYPE_LABELS,
} from '@/features/dashboard-reports/lib/types';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, ManagedDashboardReport>();

type ReportAction = (report: ManagedDashboardReport, opener: HTMLButtonElement) => void;

type DashboardReportsTableProps = {
  cards: boolean;
  search: DashboardReportsSearch;
  onSearchChange: SearchChange<DashboardReportsSearch>;
  onAdd: (opener: HTMLButtonElement) => void;
  onEdit: ReportAction;
  onDelete: ReportAction;
  dialogOpen: boolean;
};

function createColumns(t: TFunction, onEdit: ReportAction, onDelete: ReportAction) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('dashboard-reports.name')} />
      ),
      cell: ({ getValue }) => {
        const name = getValue();
        return <CellText title={name}>{name}</CellText>;
      },
      meta: { label: t('dashboard-reports.name') },
    }),
    columnHelper.accessor((report) => report.category?.name ?? '', {
      id: 'category',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('dashboard-reports.category')} />
      ),
      cell: ({ getValue }) =>
        getValue() ? <CellText title={getValue()}>{getValue()}</CellText> : null,
      meta: { label: t('dashboard-reports.category') },
    }),
    columnHelper.accessor('type', {
      enableSorting: false,
      header: () => <DataTableHeaderLabel>{t('dashboard-reports.type')}</DataTableHeaderLabel>,
      cell: ({ getValue }) => t(REPORT_TYPE_LABELS[getValue()]),
      meta: { label: t('dashboard-reports.type') },
    }),
    columnHelper.accessor('enabled', {
      enableSorting: false,
      header: () => <DataTableHeaderLabel>{t('dashboard-reports.enabled')}</DataTableHeaderLabel>,
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue()}
          trueLabel={t('dashboard-reports.yes')}
          falseLabel={t('dashboard-reports.no')}
        />
      ),
      meta: { label: t('dashboard-reports.enabled') },
    }),
    columnHelper.accessor('showOnHomePage', {
      enableSorting: false,
      header: () => <DataTableHeaderLabel>{t('dashboard-reports.home')}</DataTableHeaderLabel>,
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue()}
          trueLabel={t('dashboard-reports.yes')}
          falseLabel={t('dashboard-reports.no')}
        />
      ),
      meta: { label: t('dashboard-reports.home') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <DataTableHeaderLabel>{t('dashboard-reports.actions')}</DataTableHeaderLabel>,
      meta: { className: 'w-24', skeleton: 'control' },
      cell: ({ row: { original: report } }) => (
        <RowActions
          label={t('dashboard-reports.actions-for', { name: report.name })}
          actions={[
            {
              id: 'edit',
              icon: <PencilIcon />,
              label: t('dashboard-reports.edit'),
              onSelect: (opener) => onEdit(report, opener),
            },
            {
              id: 'delete',
              icon: <Trash2Icon />,
              label: t('dashboard-reports.delete'),
              destructive: true,
              onSelect: (opener) => onDelete(report, opener),
            },
          ]}
        />
      ),
    }),
  ]);
}

const NO_REPORTS: ManagedDashboardReport[] = [];
const getRowId = (report: ManagedDashboardReport) => report.id;

const noop = () => {};

function useDashboardReportsTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  onEdit,
  onDelete,
}: Omit<DashboardReportsTableProps, 'onAdd' | 'dialogOpen'> & {
  data: ManagedDashboardReport[];
  rowCount: number;
}) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, onEdit, onDelete), [t, onEdit, onDelete]);
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: DEFAULT_DASHBOARD_REPORTS_SORT,
    onSearchChange,
    cards,
  });

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    ...searchState,
  });
  return { table, pageStart };
}

export function DashboardReportsTableSkeleton({
  cards,
  search,
}: Pick<DashboardReportsTableProps, 'cards' | 'search'>) {
  const { table } = useDashboardReportsTable({
    cards: false,
    data: NO_REPORTS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    onEdit: noop,
    onDelete: noop,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards)
    return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" actions={2} />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function DashboardReportsTable({
  cards,
  search,
  onSearchChange,
  onAdd,
  onEdit,
  onDelete,
  dialogOpen,
}: DashboardReportsTableProps) {
  const { t, i18n } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data: reports } = useSuspenseQuery(dashboardReportsAdminOptions());
  const { language } = i18n;
  const data = useMemo(
    () => pageOfDashboardReports(reports, deferredSearch, language),
    [reports, deferredSearch, language],
  );
  const { table, pageStart } = useDashboardReportsTable({
    cards,
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    onEdit,
    onDelete,
  });
  const isStale = search !== deferredSearch;
  const lastPage = Math.max(1, data.totalPages);
  const isPastLastPage = (deferredSearch.page ?? 1) > lastPage;
  useEffect(() => {
    if (isPastLastPage && !isStale && !dialogOpen) {
      onSearchChange({ page: lastPage > 1 ? lastPage : undefined }, true, { resetScroll: false });
    }
  }, [dialogOpen, isPastLastPage, isStale, lastPage, onSearchChange]);

  const empty = !isPastLastPage && (
    <DataTableEmpty
      action={
        <Button onClick={(event) => onAdd(event.currentTarget)} size="lg">
          <PlusIcon data-icon="inline-start" />
          {t('dashboard-reports.add')}
        </Button>
      }
      description={t('dashboard-reports.empty-description')}
      icon={<ChartNoAxesCombinedIcon />}
      title={t('dashboard-reports.empty-title')}
    />
  );
  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  if (cards) {
    return (
      <TableCards
        busy={isStale}
        empty={empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="name"
      />
    );
  }
  return <DataTable empty={empty} footer={footer} isStale={isStale} table={table} />;
}
