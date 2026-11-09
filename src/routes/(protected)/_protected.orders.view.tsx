import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarX2Icon, PackageIcon, ShieldAlertIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableCard, DataTableEmpty } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { Button } from '@/components/ui/button';
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
  viewSupplierFacilitiesOptions,
} from '@/features/orders/api/queries';
import type { OrderRowAccess } from '@/features/orders/components/order-row-buttons';
import {
  ORDER_HIDEABLE_COLUMNS,
  OrdersTable,
  OrdersTableSkeleton,
  VIEW_ORDER_COLUMNS,
} from '@/features/orders/components/orders-table';
import { OrdersToolbar } from '@/features/orders/components/orders-toolbar';
import {
  SupplierSearchPicker,
  SupplierSearchPickerSkeleton,
} from '@/features/orders/components/supplier-search-picker';
import {
  canSearch,
  invalidDateRange,
  ORDER_DEFAULT_SORT,
  ORDER_SORT_FIELDS,
  toOrderParams,
  type ViewOrdersSearch,
  viewOrdersSearchSchema,
} from '@/features/orders/lib/order-search';
import {
  viewOrderSupplierIds,
  viewOrderSuppliers,
} from '@/features/orders/lib/supplying-facilities';
import {
  deploymentTimeZoneOptions,
  minimalFacilitiesOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { queryKeys } from '@/lib/key-factory';
import { facilityGrants } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import { type SearchChange, searchSort } from '@/lib/table-search';

const NO_DIALOGS = {} satisfies Partial<ViewOrdersSearch>;
const noop = () => {};
export const Route = createFileRoute('/(protected)/_protected/orders/view')({
  validateSearch: viewOrdersSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    const permissions = await requirePermissions(queryClient, [
      RIGHTS.ordersView,
      RIGHTS.podsManage,
    ]);
    queryClient.prefetchQuery(programsOptions());
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
    const facilityOptions = viewSupplierFacilitiesOptions(permissions);
    queryClient.prefetchQuery(facilityOptions);
    const suppliers = viewOrderSupplierIds(permissions).map((id) => ({ id }));
    if (search.supplyingFacilityId && suppliers.some(({ id }) => id === search.supplyingFacilityId))
      queryClient.prefetchQuery(orderRequestingFacilitiesOptions([search.supplyingFacilityId]));
    if (canSearch(search, suppliers))
      queryClient.prefetchQuery(ordersSearchOptions(toOrderParams(search)));
    return permissions;
  },
  pendingComponent: OrdersPending,
  component: OrdersPage,
});
type ColumnView = ReturnType<typeof useCardView<HTMLDivElement>>;
function OrdersHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <PackageIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('orders.view.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('orders.view.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
function ColumnsMenu({
  columnView,
  search,
  onSearchChange,
}: {
  columnView: ColumnView;
  search: ViewOrdersSearch;
  onSearchChange: SearchChange<ViewOrdersSearch>;
}) {
  const { t } = useTranslation();
  return (
    <DataTableViewOptions
      size="lg"
      layout={columnView.layout}
      columns={ORDER_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
      onReset={columnView.columnView.onReset}
      onVisibilityChange={columnView.columnView.onVisibilityChange}
      visibility={columnView.columnView.visibility}
      sort={{
        ...searchSort(search, ORDER_DEFAULT_SORT, onSearchChange),
        columns: VIEW_ORDER_COLUMNS.filter(([id]) =>
          ORDER_SORT_FIELDS.includes(id as (typeof ORDER_SORT_FIELDS)[number]),
        ).map(([id, key]) => ({ id, label: t(key) })),
      }}
    />
  );
}
function Outcome({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <DataTableCard>
      <DataTableEmpty icon={icon} title={title} description={description} action={action} />
    </DataTableCard>
  );
}
function PageSkeleton({
  columnView,
  search,
}: {
  columnView: ColumnView;
  search: ViewOrdersSearch;
}) {
  const { t } = useTranslation();
  return (
    <>
      <SupplierSearchPickerSkeleton />
      <fieldset disabled className="min-w-0">
        <OrdersToolbar search={search} disabled onFilterChange={noop} />
      </fieldset>
      {search.supplyingFacilityId ? (
        <OrdersTableSkeleton
          cards={columnView.cards}
          columns={columnView.columnView.visibility}
          search={search}
        />
      ) : (
        <Outcome
          icon={<PackageIcon />}
          title={t('orders.view.pick-title')}
          description={t('orders.view.pick-description')}
        />
      )}
    </>
  );
}
function OrdersPending() {
  const search = Route.useSearch();
  const columnView = useCardView(ORDER_HIDEABLE_COLUMNS, 'orders.view.column-visibility');
  return (
    <Workspace width="wide">
      <OrdersHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={columnView.measure}>
          <PageSkeleton columnView={columnView} search={search} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
function OrdersPage() {
  const { t } = useTranslation();
  const permissions = Route.useLoaderData();
  const search = Route.useSearch();
  const columnView = useCardView(ORDER_HIDEABLE_COLUMNS, 'orders.view.column-visibility');
  const { updateSearch } = useSearchNavigation<ViewOrdersSearch>(NO_DIALOGS);
  const access = useMemo(
    () => ({
      canEdit: permissions.rights.has(RIGHTS.orderCreate),
      retrySupplierIds: facilityGrants(permissions, RIGHTS.ordersTransfer).map(
        ({ facilityId }) => facilityId,
      ),
    }),
    [permissions],
  );
  return (
    <Workspace width="wide">
      <OrdersHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={columnView.measure}>
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                error={error}
                reset={reset}
                title={t('orders.view.error-title')}
                description={t('orders.view.error-description')}
              />
            )}
            pendingFallback={<PageSkeleton columnView={columnView} search={search} />}
            resetKey="orders-lookups"
          >
            <OrdersBody
              permissions={permissions}
              access={access}
              search={search}
              columnView={columnView}
              onSearchChange={updateSearch}
            />
          </QueryBoundary>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
function OrdersBody({
  permissions,
  access,
  search,
  columnView,
  onSearchChange,
}: {
  permissions: Awaited<ReturnType<typeof requirePermissions>>;
  access: OrderRowAccess;
  search: ViewOrdersSearch;
  columnView: ColumnView;
  onSearchChange: SearchChange<ViewOrdersSearch>;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { data: facilities } = useSuspenseQuery(viewSupplierFacilitiesOptions(permissions));
  const programQuery = useQuery(programsOptions());
  const programs = programQuery.data ?? [];
  const suppliers = useMemo(
    () => viewOrderSuppliers(permissions, facilities),
    [permissions, facilities],
  );
  const supplier = suppliers.find(({ id }) => id === search.supplyingFacilityId);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftOver, setDraftOver] = useState(search.supplyingFacilityId);
  if (draftOver !== search.supplyingFacilityId) {
    setDraftOver(search.supplyingFacilityId);
    setDraft(null);
  }
  const pending = draft !== null && draft !== supplier?.id;
  const requesters = useQuery(orderRequestingFacilitiesOptions(supplier ? [supplier.id] : []));
  const requestingIds = new Set(requesters.data ?? []);
  const requesterFacilities = useQuery({
    ...minimalFacilitiesOptions(),
    enabled: requestingIds.size > 0,
  });
  const failedLookup = [programQuery, ...(supplier ? [requesters, requesterFacilities] : [])].find(
    (query) => query.isError,
  );
  const toolbar = (
    <OrdersToolbar
      disabled={!supplier || pending}
      programsDisabled={!programQuery.isSuccess}
      facilitiesDisabled={!requesters.isSuccess || !requesterFacilities.isSuccess}
      search={search}
      facilities={(requesterFacilities.data ?? [])
        .filter(({ id }) => requestingIds.has(id))
        .map((facility) => ({
          value: facility.id,
          label: [facility.code, facility.name].filter(Boolean).join(' - '),
        }))}
      programs={programs.map(({ id, name }) => ({ value: id, label: name ?? id }))}
      onFilterChange={(patch) => onSearchChange(patch, true)}
      view={
        supplier && !pending ? (
          <ColumnsMenu columnView={columnView} search={search} onSearchChange={onSearchChange} />
        ) : undefined
      }
    />
  );
  let outcome: ReactNode;
  if (!supplier || pending) {
    const refused = !!search.supplyingFacilityId && !supplier;
    outcome = (
      <Outcome
        icon={refused ? <ShieldAlertIcon /> : <PackageIcon />}
        title={t(
          refused
            ? 'orders.view.refused-title'
            : pending
              ? 'orders.view.pending-title'
              : 'orders.view.pick-title',
        )}
        description={t(
          suppliers.length === 0
            ? 'orders.view.no-suppliers'
            : refused
              ? 'orders.view.refused-description'
              : pending
                ? 'orders.view.pending-description'
                : 'orders.view.pick-description',
        )}
      />
    );
  } else {
    outcome = (
      <SupplierResults
        search={search}
        access={access}
        columnView={columnView}
        onSearchChange={onSearchChange}
      />
    );
  }
  return (
    <>
      <SupplierSearchPicker
        options={suppliers}
        applied={search.supplyingFacilityId}
        onDraftChange={setDraft}
        onSearch={(id) => {
          onSearchChange((previous) => ({
            supplyingFacilityId: id,
            requestingFacilityId:
              previous.supplyingFacilityId === id ? previous.requestingFacilityId : undefined,
            page: undefined,
          }));
          if (id === search.supplyingFacilityId)
            void client.invalidateQueries({ queryKey: [...queryKeys.orders.all, 'list'] });
        }}
      />
      {!pending && toolbar}
      {failedLookup && (
        <ListError
          error={failedLookup.error}
          reset={() => void failedLookup.refetch()}
          title={t('orders.view.error-title')}
          description={t('orders.view.error-description')}
        />
      )}
      {outcome}
    </>
  );
}
function SupplierResults({
  search,
  access,
  columnView,
  onSearchChange,
}: {
  search: ViewOrdersSearch;
  access: OrderRowAccess;
  columnView: ColumnView;
  onSearchChange: SearchChange<ViewOrdersSearch>;
}) {
  const { t } = useTranslation();
  return (
    <>
      {invalidDateRange(search) ? (
        <Outcome
          icon={<CalendarX2Icon />}
          title={t('orders.view.date-range-title')}
          description={t('orders.view.date-range-description')}
          action={
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                onSearchChange(
                  { periodStart: undefined, periodEnd: undefined, page: undefined },
                  true,
                )
              }
            >
              {t('orders.view.clear-dates')}
            </Button>
          }
        />
      ) : (
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <ListError
              error={error}
              reset={reset}
              title={t('orders.view.error-title')}
              description={t('orders.view.error-description')}
            />
          )}
          pendingFallback={
            <OrdersTableSkeleton
              cards={columnView.cards}
              columns={columnView.columnView.visibility}
              search={search}
            />
          }
          resetKey={JSON.stringify(toOrderParams(search))}
        >
          <OrdersTable
            cards={columnView.cards}
            columns={columnView.columnView.visibility}
            search={search}
            access={access}
            onSearchChange={onSearchChange}
          />
        </QueryBoundary>
      )}
    </>
  );
}
