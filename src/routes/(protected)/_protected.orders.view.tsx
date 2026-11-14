import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarX2Icon, PackageIcon, ShieldAlertIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { OrdersError } from '@/features/orders/components/orders-error';
import {
  ORDER_HIDEABLE_COLUMNS,
  OrdersTable,
  OrdersTableSkeleton,
} from '@/features/orders/components/orders-table';
import { OrdersToolbar } from '@/features/orders/components/orders-toolbar';
import { OrdersViewOptions } from '@/features/orders/components/orders-view-options';
import {
  SupplierSearchPicker,
  SupplierSearchPickerSkeleton,
} from '@/features/orders/components/supplier-search-picker';
import { useOrderFilterOptions } from '@/features/orders/hooks/use-order-filter-options';
import type { OrderAccess } from '@/features/orders/lib/order-row-actions';
import {
  invalidDateRange,
  toOrderParams,
  type ViewOrdersSearch,
  viewOrdersSearchSchema,
} from '@/features/orders/lib/order-search';
import {
  viewOrderSupplierIds,
  viewOrderSuppliers,
} from '@/features/orders/lib/supplying-facilities';
import { deploymentTimeZoneOptions, programsOptions } from '@/features/reference-data/api/queries';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { ORDER_LISTS_KEY } from '@/lib/order-queries';
import { facilityGrants } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import type { SearchChange } from '@/lib/table-search';

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
    if (
      search.supplyingFacilityId &&
      viewOrderSupplierIds(permissions).includes(search.supplyingFacilityId)
    ) {
      queryClient.prefetchQuery(orderRequestingFacilitiesOptions([search.supplyingFacilityId]));
      if (!invalidDateRange(search))
        queryClient.prefetchQuery(ordersSearchOptions(toOrderParams(search)));
    }
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
        <OrdersToolbar
          search={search}
          disabled
          onFilterChange={noop}
          view={
            search.supplyingFacilityId ? <DataTableViewOptions size="lg" disabled /> : undefined
          }
        />
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
            errorComponent={OrdersError}
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
  access: OrderAccess;
  search: ViewOrdersSearch;
  columnView: ColumnView;
  onSearchChange: SearchChange<ViewOrdersSearch>;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { data: facilities } = useSuspenseQuery(viewSupplierFacilitiesOptions(permissions));
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
  const { failedLookup, ...filters } = useOrderFilterOptions(supplier ? [supplier.id] : []);
  const toolbar = (
    <OrdersToolbar
      disabled={!supplier || pending}
      search={search}
      {...filters}
      onFilterChange={(patch) => onSearchChange(patch, true)}
      view={
        supplier && !pending ? (
          <OrdersViewOptions
            columnView={columnView}
            search={search}
            onSearchChange={onSearchChange}
          />
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
          if (id === search.supplyingFacilityId)
            void client.invalidateQueries({
              queryKey: ORDER_LISTS_KEY,
              refetchType: search.page ? 'none' : 'active',
            });
          onSearchChange((previous) => ({
            supplyingFacilityId: id,
            requestingFacilityId:
              previous.supplyingFacilityId === id ? previous.requestingFacilityId : undefined,
            page: undefined,
          }));
        }}
      />
      {!pending && toolbar}
      {failedLookup && (
        <OrdersError error={failedLookup.error} reset={() => void failedLookup.refetch()} />
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
  access: OrderAccess;
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
          errorComponent={OrdersError}
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
