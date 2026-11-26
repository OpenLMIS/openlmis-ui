import { useSuspenseQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { PencilIcon, PlusIcon, TagsIcon, Trash2Icon } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { reportCategoriesPageOptions } from '@/features/report-categories/api/queries';
import {
  DEFAULT_REPORT_CATEGORIES_SORT,
  type ReportCategoriesSearch,
  toReportCategoriesQuery,
} from '@/features/report-categories/lib/search';
import type { ReportCategory } from '@/features/report-categories/lib/types';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, ReportCategory>();

type CategoryAction = (category: ReportCategory, opener: HTMLButtonElement) => void;

type ReportCategoriesTableProps = {
  cards: boolean;
  search: ReportCategoriesSearch;
  onSearchChange: SearchChange<ReportCategoriesSearch>;
  onAdd: (opener: HTMLButtonElement) => void;
  onEdit: CategoryAction;
  onDelete: CategoryAction;
  dialogOpen: boolean;
};

function createColumns(t: TFunction, onEdit: CategoryAction, onDelete: CategoryAction) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report-categories.name')} />
      ),
      cell: ({ getValue }) => {
        const name = getValue();
        return <CellText title={name}>{name}</CellText>;
      },
      meta: { label: t('report-categories.name') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <DataTableHeaderLabel>{t('report-categories.actions')}</DataTableHeaderLabel>,
      meta: { className: 'w-24', skeleton: 'control' },
      cell: ({ row: { original: category } }) => (
        <RowActions
          label={t('report-categories.actions-for', { name: category.name })}
          actions={[
            {
              id: 'edit',
              icon: <PencilIcon />,
              label: t('report-categories.edit'),
              onSelect: (opener) => onEdit(category, opener),
            },
            {
              id: 'delete',
              icon: <Trash2Icon />,
              label: t('report-categories.delete'),
              destructive: true,
              onSelect: (opener) => onDelete(category, opener),
            },
          ]}
        />
      ),
    }),
  ]);
}

const NO_CATEGORIES: ReportCategory[] = [];
const getRowId = (category: ReportCategory) => category.id;

const noop = () => {};

function useReportCategoriesTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  onEdit,
  onDelete,
}: Omit<ReportCategoriesTableProps, 'onAdd' | 'dialogOpen'> & {
  data: ReportCategory[];
  rowCount: number;
}) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, onEdit, onDelete), [t, onEdit, onDelete]);
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: DEFAULT_REPORT_CATEGORIES_SORT,
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

export function ReportCategoriesTableSkeleton({
  cards,
  search,
}: Pick<ReportCategoriesTableProps, 'cards' | 'search'>) {
  const { table } = useReportCategoriesTable({
    cards: false,
    data: NO_CATEGORIES,
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

export function ReportCategoriesTable({
  cards,
  search,
  onSearchChange,
  onAdd,
  onEdit,
  onDelete,
  dialogOpen,
}: ReportCategoriesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(
    reportCategoriesPageOptions(toReportCategoriesQuery(deferredSearch)),
  );
  const { table, pageStart } = useReportCategoriesTable({
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
          {t('report-categories.add')}
        </Button>
      }
      description={t('report-categories.empty-description')}
      icon={<TagsIcon />}
      title={t('report-categories.empty-title')}
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
