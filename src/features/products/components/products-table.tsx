import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, PackageIcon, PencilIcon, SearchXIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { CellText, TableCards, TableCardsSkeleton, useInCards } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { productsListOptions } from '@/features/products/api/queries';
import {
  CLEARED_PRODUCT_FILTERS,
  DEFAULT_PRODUCTS_SORT,
  hasProductFilters,
  type ProductsSearch,
  toProductsQuery,
} from '@/features/products/lib/search';
import type { Product } from '@/features/products/lib/types';
import { productName } from '@/features/reference-data/lib/product-name';
import { usePageStart } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, Product>();

function createColumns(t: TFunction, listSearch: ProductsSearch) {
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
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="block whitespace-normal break-words" dir="auto">
            {getValue()}
          </span>
        ) : null,
      meta: { className: '@2xl/main:w-2/5', label: t('products.name') },
    }),
    columnHelper.accessor('description', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('products.description')} />
      ),
      cell: ({ getValue }) =>
        getValue() ? <CellText overflow="clamp">{getValue()}</CellText> : null,
      meta: { label: t('products.description') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('products.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <ProductActions listSearch={listSearch} product={row.original} />,
    }),
  ]);
}

type ProductActionsProps = {
  product: Product;
  listSearch: ProductsSearch;
};

function ProductActions({ product, listSearch }: ProductActionsProps) {
  const { t } = useTranslation();

  const label = t('products.actions-for', {
    product: productName(product),
  });

  if (useInCards()) {
    return (
      <CardActions
        label={label}
        actions={[
          {
            id: 'edit',
            icon: <PencilIcon />,
            label: t('products.edit'),
            link: (
              <Link
                params={{ id: product.id }}
                state={{ productsListSearch: listSearch }}
                to="/administration/products/$id/general"
              />
            ),
          },
        ]}
      />
    );
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button aria-label={label} size="icon-sm" variant="ghost" />}>
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" width="auto">
          <DropdownMenuItem
            render={
              <Link
                params={{ id: product.id }}
                state={{ productsListSearch: listSearch }}
                to="/administration/products/$id/general"
              />
            }
          >
            <PencilIcon />
            {t('products.edit')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type ProductsTableProps = {
  cards: boolean;
  search: ProductsSearch;
  onSearchChange: SearchChange<ProductsSearch>;
  columnVisibility: ColumnVisibilityState;
};

const NO_PRODUCTS: Product[] = [];

const getRowId = (product: Product) => product.id;

const noop = () => {};

function useProductsTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: ProductsTableProps & { data: Product[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, search), [t, search]);
  const { pageIndex, pageSize } = toPaginationState(search);
  const pageStart = usePageStart<HTMLUListElement>(`${pageIndex}:${pageSize}`, cards);
  const onTableChange = useCallback<SearchChange<ProductsSearch>>(
    (update) => onSearchChange(update, false, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_PRODUCTS_SORT,
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
    enableSorting: false,
    ...searchState,
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
    state: { ...searchState.state, columnVisibility },
  });
  return { table, pageStart };
}

export function ProductsTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<ProductsTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useProductsTable({
    cards: false,
    data: NO_PRODUCTS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });

  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="productCode" />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function ProductsTable({
  cards,
  search,
  onSearchChange,
  columnVisibility,
}: ProductsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(productsListOptions(toProductsQuery(deferredSearch)));
  const { table, pageStart } = useProductsTable({
    cards,
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

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

  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferredSearch;
  if (cards) {
    return (
      <TableCards
        busy={isStale}
        empty={!isPastLastPage && empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="productCode"
      />
    );
  }
  return (
    <DataTable empty={!isPastLastPage && empty} footer={footer} isStale={isStale} table={table} />
  );
}
