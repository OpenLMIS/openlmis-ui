import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { PackageIcon, SearchXIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { productsListOptions } from '@/features/products/api/queries';
import {
  CLEARED_PRODUCT_FILTERS,
  hasProductFilters,
  type ProductsSearch,
  toProductsQuery,
} from '@/features/products/lib/search';
import type { Product } from '@/features/products/lib/types';
import {
  type DefaultSort,
  type SearchChange,
  toPaginationState,
  useTableSearchState,
} from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, Product>();

const PRODUCTS_SORT: DefaultSort = { id: 'fullProductName', desc: false };

const muted = <span className="text-muted-foreground">-</span>;

function createColumns(t: TFunction) {
  return columnHelper.columns([
    columnHelper.accessor('productCode', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('products.code')} />,
      cell: ({ getValue }) => (
        <span className="font-medium" dir="ltr">
          {getValue()}
        </span>
      ),
      meta: { className: 'w-32 @xl/main:w-40' },
    }),
    columnHelper.accessor('fullProductName', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('products.name')} />,
      cell: ({ getValue }) => getValue() || muted,
      meta: { className: '@2xl/main:w-2/5' },
    }),
    columnHelper.accessor('description', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('products.description')} />
      ),
      cell: ({ getValue }) => getValue() || muted,
    }),
  ]);
}

type ProductsTableProps = {
  search: ProductsSearch;
  onSearchChange: SearchChange<ProductsSearch>;
  columnVisibility: ColumnVisibilityState;
};

const NO_PRODUCTS: Product[] = [];

const getRowId = (product: Product) => product.id;

const noop = () => {};

/** The one table setup, shared by the real table and its skeleton so both lay out the same. */
function useProductsTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: ProductsTableProps & { data: Product[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t), [t]);
  const searchState = useTableSearchState({
    search,
    defaultSort: PRODUCTS_SORT,
    onSearchChange,
  });

  return useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    // The server orders a filtered list by name whatever it is asked, so no column sorts.
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
}

export function ProductsTableSkeleton({
  search,
  columnVisibility,
}: Pick<ProductsTableProps, 'search' | 'columnVisibility'>) {
  const table = useProductsTable({
    data: NO_PRODUCTS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });

  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function ProductsTable({ search, onSearchChange, columnVisibility }: ProductsTableProps) {
  const { t } = useTranslation();
  // Keeps the current page on screen, dimmed, while the next one loads instead of suspending.
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(productsListOptions(toProductsQuery(deferredSearch)));
  const table = useProductsTable({
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

  // A stale link or a smaller page size can point past the end; move to the last page that exists.
  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
    }
  }, [isPastLastPage, data.totalPages, onSearchChange]);

  const empty = hasProductFilters(deferredSearch) ? (
    <DataTableEmpty
      action={
        <Button onClick={() => onSearchChange(CLEARED_PRODUCT_FILTERS)} variant="destructive">
          {t('products.clear-filters')}
        </Button>
      }
      description={t('products.no-results-description')}
      icon={<SearchXIcon />}
      title={t('products.no-results-title')}
    />
  ) : (
    <DataTableEmpty
      description={t('products.empty-description')}
      icon={<PackageIcon />}
      title={t('products.empty-title')}
    />
  );

  return (
    <DataTable
      empty={!isPastLastPage && empty}
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
