import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, FolderXIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FlagBadge } from '@/components/flag-badge';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { rejectionReasonCategoriesOptions } from '@/features/reference-data/api/queries';
import type { RejectionReasonCategory } from '@/features/reference-data/lib/types';
import { pageOfCategories } from '@/features/rejection-reasons/lib/categories-list';
import {
  type CategoriesListSearch,
  DEFAULT_CATEGORIES_SORT,
} from '@/features/rejection-reasons/lib/search';
import { usePageStart } from '@/hooks/use-page-start';
import { markDialogOpened } from '@/hooks/use-search-navigation';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, RejectionReasonCategory>();

function createColumns(t: TFunction, listSearch: CategoriesListSearch) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reason-categories.name')} />
      ),
      cell: ({ getValue }) => (getValue() ? <CellText strong>{getValue()}</CellText> : null),
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reason-categories.code')} />
      ),
      cell: ({ getValue }) => <CellText dir="ltr">{getValue()}</CellText>,
      meta: { className: '@xl/main:w-1/4', label: t('rejection-reason-categories.code') },
    }),
    columnHelper.accessor('active', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reason-categories.active')} />
      ),
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue()}
          trueLabel={t('rejection-reason-categories.active')}
          falseLabel={t('rejection-reason-categories.inactive-label')}
        />
      ),
      meta: { className: 'w-32', label: t('rejection-reason-categories.active') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('rejection-reason-categories.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <CategoryActions listSearch={listSearch} category={row.original} />,
    }),
  ]);
}

function CategoryActions({
  category,
  listSearch,
}: {
  category: RejectionReasonCategory;
  listSearch: CategoriesListSearch;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('rejection-reason-categories.actions-for', { name: category.name })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" width="auto">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link
                  to="/administration/rejection-reason-categories"
                  search={{ ...listSearch, category: category.id }}
                  state={markDialogOpened}
                />
              }
            >
              <PencilIcon />
              {t('rejection-reason-categories.edit')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type CategoriesTableProps = {
  cards: boolean;
  search: CategoriesListSearch;
  onSearchChange: SearchChange<CategoriesListSearch>;
  columnVisibility: ColumnVisibilityState;
  onAdd: () => void;
};

const NO_CATEGORIES: RejectionReasonCategory[] = [];

const getRowId = (category: RejectionReasonCategory) => category.id;

const noop = () => {};

function useCategoriesTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: Omit<CategoriesTableProps, 'onAdd'> & { data: RejectionReasonCategory[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, search), [t, search]);
  const { pageIndex, pageSize } = toPaginationState(search);
  const pageStart = usePageStart<HTMLUListElement>(`${pageIndex}:${pageSize}`, cards);
  const onTableChange = useCallback<SearchChange<CategoriesListSearch>>(
    (update) => onSearchChange(update, false, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_CATEGORIES_SORT,
    onSearchChange: onTableChange,
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
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
    state: { ...searchState.state, columnVisibility },
  });
  return { table, pageStart };
}

export function CategoriesTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<CategoriesTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useCategoriesTable({
    cards: false,
    data: NO_CATEGORIES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function CategoriesTable({
  cards,
  search,
  onSearchChange,
  columnVisibility,
  onAdd,
}: CategoriesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data: categories } = useSuspenseQuery(rejectionReasonCategoriesOptions());
  const data = useMemo(
    () => pageOfCategories(categories, deferredSearch),
    [categories, deferredSearch],
  );
  const { table, pageStart } = useCategoriesTable({
    cards,
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
  });
  const isPastLastPage = (deferredSearch.page ?? 1) !== data.page;

  useEffect(() => {
    if (isPastLastPage && search === deferredSearch) {
      onSearchChange({ page: data.page > 1 ? data.page : undefined }, true);
    }
  }, [isPastLastPage, data.page, onSearchChange, search, deferredSearch]);

  const empty = (
    <DataTableEmpty
      action={
        search.name ? (
          <Button
            onClick={() => onSearchChange({ name: undefined, page: undefined }, true)}
            variant="outline"
          >
            {t('rejection-reason-categories.clear')}
          </Button>
        ) : (
          <Button onClick={onAdd}>
            <PlusIcon data-icon="inline-start" />
            {t('rejection-reason-categories.add')}
          </Button>
        )
      }
      description={t(
        search.name
          ? 'rejection-reason-categories.no-matches-description'
          : 'rejection-reason-categories.empty-description',
      )}
      icon={<FolderXIcon />}
      title={t(
        search.name
          ? 'rejection-reason-categories.no-matches-title'
          : 'rejection-reason-categories.empty-title',
      )}
    />
  );
  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferredSearch;
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
