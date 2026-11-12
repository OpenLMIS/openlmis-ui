import { createFileRoute } from '@tanstack/react-router';
import { PackageOpenIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requirePermissions } from '@/features/auth/lib/access';
import {
  orderRequestingFacilitiesOptions,
  ordersSearchOptions,
} from '@/features/orders/api/queries';
import { OrdersError } from '@/features/orders/components/orders-error';
import {
  FULFILL_ORDER_HIDEABLE_COLUMNS,
  OrdersTable,
  OrdersTableSkeleton,
} from '@/features/orders/components/orders-table';
import { OrdersToolbar } from '@/features/orders/components/orders-toolbar';
import { OrdersViewOptions } from '@/features/orders/components/orders-view-options';
import { useOrderFilterOptions } from '@/features/orders/hooks/use-order-filter-options';
import {
  type FulfillOrdersSearch,
  fulfillOrdersSearchSchema,
  toOrderParams,
} from '@/features/orders/lib/order-search';
import { fulfillOrderSupplierIds } from '@/features/orders/lib/supplying-facilities';
import { deploymentTimeZoneOptions, programsOptions } from '@/features/reference-data/api/queries';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { RIGHTS } from '@/lib/rights';

const NO_DIALOGS = {} satisfies Partial<FulfillOrdersSearch>;
const noop = () => {};
export const Route = createFileRoute('/(protected)/_protected/orders/fulfillment')({
  validateSearch: fulfillOrdersSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    const permissions = await requirePermissions(queryClient, [
      RIGHTS.shipmentsView,
      RIGHTS.shipmentsEdit,
    ]);
    queryClient.prefetchQuery(ordersSearchOptions(toOrderParams(search, 'fulfill')));
    queryClient.prefetchQuery(programsOptions());
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
    const supplierIds = fulfillOrderSupplierIds(permissions);
    if (supplierIds.length)
      queryClient.prefetchQuery(orderRequestingFacilitiesOptions(supplierIds));
    return permissions;
  },
  pendingComponent: FulfillOrdersPending,
  component: FulfillOrdersPage,
});

function FulfillOrdersHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <PackageOpenIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('orders.fulfill.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('orders.fulfill.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function FulfillOrdersPending() {
  const search = Route.useSearch();
  const view = useCardView(FULFILL_ORDER_HIDEABLE_COLUMNS, 'orders.fulfill.column-visibility');
  return (
    <Workspace>
      <FulfillOrdersHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={view.measure}>
          <OrdersToolbar
            kind="fulfill"
            search={search}
            disabled
            view={<DataTableViewOptions size="lg" disabled />}
            onFilterChange={noop}
          />
          <OrdersTableSkeleton
            kind="fulfill"
            cards={view.cards}
            columns={view.columnView.visibility}
            search={search}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function FulfillOrdersPage() {
  const view = useCardView(FULFILL_ORDER_HIDEABLE_COLUMNS, 'orders.fulfill.column-visibility');
  return (
    <Workspace>
      <FulfillOrdersHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={view.measure}>
          <FulfillOrdersResults view={view} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function FulfillOrdersResults({ view }: { view: ReturnType<typeof useCardView<HTMLDivElement>> }) {
  const permissions = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<FulfillOrdersSearch>(NO_DIALOGS);
  const { failedLookup, ...filters } = useOrderFilterOptions(fulfillOrderSupplierIds(permissions));
  const skeleton = (
    <OrdersTableSkeleton
      kind="fulfill"
      cards={view.cards}
      columns={view.columnView.visibility}
      search={search}
    />
  );
  return (
    <>
      <OrdersToolbar
        kind="fulfill"
        search={search}
        {...filters}
        onFilterChange={(patch) => updateSearch(fulfillOrdersSearchSchema.parse(patch), true)}
        view={
          <OrdersViewOptions
            kind="fulfill"
            columnView={view}
            search={search}
            onSearchChange={updateSearch}
          />
        }
      />
      {failedLookup && (
        <OrdersError error={failedLookup.error} reset={() => void failedLookup.refetch()} />
      )}
      <QueryBoundary
        errorComponent={OrdersError}
        pendingFallback={skeleton}
        resetKey={JSON.stringify(toOrderParams(search, 'fulfill'))}
      >
        <OrdersTable
          kind="fulfill"
          cards={view.cards}
          columns={view.columnView.visibility}
          search={search}
          onSearchChange={updateSearch}
        />
      </QueryBoundary>
    </>
  );
}
