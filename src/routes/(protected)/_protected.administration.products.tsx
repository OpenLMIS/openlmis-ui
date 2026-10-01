import { createFileRoute } from '@tanstack/react-router';
import { PackageIcon } from 'lucide-react';
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

const CLOSED_DIALOGS = { product: undefined } satisfies Partial<ProductsSearch>;

export const Route = createFileRoute('/(protected)/_protected/administration/products')({
  validateSearch: productsSearchSchema,
  loaderDeps: ({ search }) => ({ query: toProductsQuery(search) }),
  // Either right opens the list, as in legacy.
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, [
      RIGHTS.orderablesManage,
      RIGHTS.facilityApprovedOrderablesManage,
    ]);
    queryClient.prefetchQuery(productsListOptions(deps.query));
    queryClient.prefetchQuery(programsOptions());
  },
  pendingComponent: ProductsPagePending,
  component: ProductsPage,
});

const columnChoicesSchema = z.record(z.string(), z.boolean());

function ProductsPage() {
  const { t } = useTranslation();
  // Without the dialog's param, and shared structurally, so opening the dialog leaves the table alone.
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

  // Typing in a filter replaces the history entry; paging adds one, so Back steps through pages.
  const { updateSearch } = useSearchNavigation<ProductsSearch>(CLOSED_DIALOGS);

  return (
    <Workspace>
      <ProductsHeader />
      <WorkspaceContent>
        {/* Measured, because the room for columns depends on the sidebar as well as the window. */}
        <div className="flex flex-col gap-4 lg:gap-6" ref={measureContent}>
          <ProductsToolbar
            columnView={columnView}
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

/** While the rights check runs on a first visit: the page's header over a table skeleton. */
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
