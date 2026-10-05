import { createFileRoute } from '@tanstack/react-router';
import { PackageIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { productsListOptions } from '@/features/products/api/queries';
import {
  ProductsTable,
  ProductsTableSkeleton,
} from '@/features/products/components/products-table';
import { ProductsToolbar } from '@/features/products/components/products-toolbar';
import {
  PRODUCT_HIDEABLE_COLUMNS,
  type ProductsSearch,
  productsSearchSchema,
  toProductsQuery,
} from '@/features/products/lib/search';
import { programsOptions } from '@/features/reference-data/api/queries';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';

const loadDialog = () => import('@/features/products/components/add-product-dialog');
const AddProductDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.AddProductDialog })),
);

const CLOSED_DIALOGS = { product: undefined } satisfies Partial<ProductsSearch>;

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: extending the router's type needs interface merging.
  interface HistoryState {
    productsListSearch?: ProductsSearch;
  }
}

export const Route = createFileRoute('/(protected)/_protected/administration/products')({
  validateSearch: productsSearchSchema,
  loaderDeps: ({ search }) => ({ query: toProductsQuery(search) }),
  loader: async ({ context: { queryClient }, deps }) => {
    const rights = await requireRight(queryClient, [
      RIGHTS.orderablesManage,
      RIGHTS.facilityApprovedOrderablesManage,
    ]);
    queryClient.prefetchQuery(productsListOptions(deps.query));
    queryClient.prefetchQuery(programsOptions());
    return { canAdd: rights.has(RIGHTS.orderablesManage) };
  },
  pendingComponent: ProductsPagePending,
  component: ProductsPage,
});

const columnChoicesSchema = z.record(z.string(), z.boolean());

function ProductsPage() {
  const { t } = useTranslation();
  const { canAdd } = Route.useLoaderData();
  const search = Route.useSearch({
    select: ({ product: _product, ...list }): ProductsSearch => list,
    structuralSharing: true,
  });
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    PRODUCT_HIDEABLE_COLUMNS,
    useStoredState('products.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );
  const query = Route.useLoaderDeps({ select: (deps) => deps.query });

  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<ProductsSearch>(CLOSED_DIALOGS);
  const adding = Route.useSearch({ select: (search) => canAdd && search.product === 'new' });
  const addProduct = useCallback(() => openDialog({ product: 'new' }), [openDialog]);
  const navigate = Route.useNavigate();
  const openProduct = (id: string) =>
    void navigate({
      to: '/administration/products/$id/general',
      params: { id },
      state: { productsListSearch: search },
      replace: true,
    });
  const [dialogMounted, setDialogMounted] = useState(adding);
  if (adding && !dialogMounted) setDialogMounted(true);
  useEffect(() => {
    if (canAdd) void loadDialog();
  }, [canAdd]);

  return (
    <Workspace>
      <ProductsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measureContent}>
          <ProductsToolbar
            columnView={columnView}
            onAdd={canAdd ? addProduct : undefined}
            onFilterChange={(patch) => updateSearch(patch, true)}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('products.error-description')}
                error={error}
                reset={reset}
                title={t('products.error-title')}
              />
            )}
            pendingFallback={
              <ProductsTableSkeleton columnVisibility={columnView.visibility} search={search} />
            }
            resetKey={JSON.stringify(query)}
          >
            <ProductsTable
              columnVisibility={columnView.visibility}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {dialogMounted && (
          <Suspense fallback={null}>
            <AddProductDialog onClose={closeDialog} onCreated={openProduct} open={adding} />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function ProductsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <PackageIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('products.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('products.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function ProductsPagePending() {
  return (
    <Workspace>
      <ProductsHeader />
      <WorkspaceContent>
        <ProductsTableSkeleton columnVisibility={{}} search={{}} />
      </WorkspaceContent>
    </Workspace>
  );
}
