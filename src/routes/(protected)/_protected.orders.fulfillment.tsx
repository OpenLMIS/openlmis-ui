import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { PackageOpenIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
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
import {
  FULFILL_ORDER_COLUMNS,
  FULFILL_ORDER_HIDEABLE_COLUMNS,
  OrdersTable,
  OrdersTableSkeleton,
} from '@/features/orders/components/orders-table';
import { OrdersToolbar } from '@/features/orders/components/orders-toolbar';
import {
  type FulfillOrdersSearch,
  fulfillOrdersSearchSchema,
  ORDER_DEFAULT_SORT,
  ORDER_SORT_FIELDS,
  toOrderParams,
} from '@/features/orders/lib/order-search';
import { FULFILL_STATUSES } from '@/features/orders/lib/order-status';
import { fulfillOrderSupplierIds } from '@/features/orders/lib/supplying-facilities';
import {
  deploymentTimeZoneOptions,
  minimalFacilitiesOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { useBackToLegacy } from '@/hooks/use-back-to-legacy';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { RIGHTS } from '@/lib/rights';
import { searchSort } from '@/lib/table-search';

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
  const legacy = useBackToLegacy();
  const search = Route.useSearch();
  const view = useCardView(FULFILL_ORDER_HIDEABLE_COLUMNS, 'orders.fulfill.column-visibility');
  return (
    <Workspace width="wide">
      <FulfillOrdersHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={view.measure}>
          <OrdersToolbar
            kind="fulfill"
            search={search}
            statuses={FULFILL_STATUSES}
            periods={false}
            disabled
            view={<DataTableViewOptions size="lg" disabled />}
            onFilterChange={noop}
          />
          <OrdersTableSkeleton
            kind="fulfill"
            legacyAvailable={legacy.available}
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
    <Workspace width="wide">
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
  const { t } = useTranslation();
  const legacy = useBackToLegacy();
  const permissions = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<FulfillOrdersSearch>(NO_DIALOGS);
  const programQuery = useQuery(programsOptions());
  const programs = programQuery.data ?? [];
  const supplierIds = fulfillOrderSupplierIds(permissions);
  const requesters = useQuery(orderRequestingFacilitiesOptions(supplierIds));
  const facilityQuery = useQuery({
    ...minimalFacilitiesOptions(),
    enabled: (requesters.data?.length ?? 0) > 0,
  });
  const facilities = facilityQuery.data ?? [];
  const requestingIds = new Set(requesters.data ?? []);
  const failedLookup = [facilityQuery, programQuery, requesters].find((query) => query.isError);
  const skeleton = (
    <OrdersTableSkeleton
      kind="fulfill"
      legacyAvailable={legacy.available}
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
        statuses={FULFILL_STATUSES}
        periods={false}
        programsDisabled={!programQuery.isSuccess}
        facilitiesDisabled={!requesters.isSuccess || !facilityQuery.isSuccess}
        facilities={facilities
          .filter(({ id }) => requestingIds.has(id))
          .map(({ id, code, name }) => ({
            value: id,
            label: [code, name].filter(Boolean).join(' - '),
          }))}
        programs={programs.map(({ id, name }) => ({ value: id, label: name ?? id }))}
        onFilterChange={(patch) =>
          updateSearch(
            (previous) => fulfillOrdersSearchSchema.parse({ ...previous, ...patch }),
            true,
          )
        }
        view={
          <DataTableViewOptions
            size="lg"
            layout={view.layout}
            columns={FULFILL_ORDER_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
              id,
              label: t(labelKey),
            }))}
            {...view.columnView}
            sort={{
              ...searchSort(search, ORDER_DEFAULT_SORT, updateSearch),
              columns: FULFILL_ORDER_COLUMNS.filter(([id]) =>
                ORDER_SORT_FIELDS.includes(id as (typeof ORDER_SORT_FIELDS)[number]),
              ).map(([id, key]) => ({ id, label: t(key) })),
            }}
          />
        }
      />
      {failedLookup && (
        <ListError
          error={failedLookup.error}
          reset={() => void failedLookup.refetch()}
          title={t('orders.view.error-title')}
          description={t('orders.view.error-description')}
        />
      )}
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <ListError
            error={error}
            reset={reset}
            title={t('orders.view.error-title')}
            description={t('orders.view.error-description')}
          />
        )}
        pendingFallback={skeleton}
        resetKey={JSON.stringify(toOrderParams(search, 'fulfill'))}
      >
        <OrdersTable
          kind="fulfill"
          legacyAvailable={legacy.available}
          cards={view.cards}
          columns={view.columnView.visibility}
          search={search}
          onSearchChange={updateSearch}
        />
      </QueryBoundary>
    </>
  );
}
