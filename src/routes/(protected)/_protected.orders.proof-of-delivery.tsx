import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { ClipboardCheckIcon, ShieldAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableToolbar,
} from '@/components/data-table/data-table';
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
import { ordersSearchOptions, viewSupplierFacilitiesOptions } from '@/features/orders/api/queries';
import { OrdersError } from '@/features/orders/components/orders-error';
import {
  OrdersTable,
  OrdersTableSkeleton,
  POD_ORDER_HIDEABLE_COLUMNS,
} from '@/features/orders/components/orders-table';
import { OrdersViewOptions } from '@/features/orders/components/orders-view-options';
import {
  PodSearchPicker,
  PodSearchPickerSkeleton,
  type PodSelection,
} from '@/features/orders/components/pod-search-picker';
import {
  canSearchPods,
  type PodListSearch,
  podSearchSchema,
  refusedPodSearch,
  solePodSearch,
  toPodParams,
} from '@/features/orders/lib/pod-search';
import {
  podRequestingFacilityIds,
  podSupplyingFacilityIds,
} from '@/features/orders/lib/supplying-facilities';
import {
  deploymentTimeZoneOptions,
  userProgramsOptions,
} from '@/features/reference-data/api/queries';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { ORDER_LISTS_KEY } from '@/lib/order-queries';
import { RIGHTS } from '@/lib/rights';
import { getSessionUserId } from '@/lib/session-scope';

const NO_DIALOGS = {};
export const Route = createFileRoute('/(protected)/_protected/orders/proof-of-delivery')({
  validateSearch: podSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    const permissions = await requirePermissions(queryClient, [
      RIGHTS.podsManage,
      RIGHTS.podsView,
      RIGHTS.shipmentsEdit,
    ]);
    const programs = await queryClient.ensureQueryData(
      userProgramsOptions(getSessionUserId() ?? ''),
    );
    const allowed = {
      programIds: programs.map(({ id }) => id),
      requestingFacilityIds: podRequestingFacilityIds(permissions),
      supplyingFacilityIds: podSupplyingFacilityIds(permissions),
    };
    const sole = solePodSearch(search, allowed.programIds, allowed.requestingFacilityIds);
    if (sole) throw redirect({ to: '/orders/proof-of-delivery', search: sole, replace: true });
    const refused = refusedPodSearch(search, allowed);
    if (!refused) {
      queryClient.prefetchQuery(
        viewSupplierFacilitiesOptions([
          ...allowed.requestingFacilityIds,
          ...allowed.supplyingFacilityIds,
        ]),
      );
      queryClient.prefetchQuery(deploymentTimeZoneOptions());
      if (canSearchPods(search))
        queryClient.prefetchQuery(ordersSearchOptions(toPodParams(search)));
    }
    return { programs, allowed, refused };
  },
  pendingComponent: PodPending,
  component: PodPage,
});
function PodHeader({ facility, program }: { facility?: string | null; program?: string | null }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardCheckIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>
          {program
            ? facility
              ? t('orders.pod.title-facility', { facility, program })
              : t('orders.pod.title-program', { program })
            : t('orders.pod.title')}
        </WorkspaceTitle>
        <WorkspaceDescription>{t('orders.pod.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
function PodPending() {
  return (
    <Workspace width="large">
      <PodHeader />
      <WorkspaceContent>
        <PodSearchPickerSkeleton />
      </WorkspaceContent>
    </Workspace>
  );
}
function Outcome({ state }: { state: 'pick' | 'pending' | 'refused' }) {
  const { t } = useTranslation();
  return (
    <DataTableCard>
      <DataTableEmpty
        icon={state === 'refused' ? <ShieldAlertIcon /> : <ClipboardCheckIcon />}
        title={t(`orders.pod.${state}-title`)}
        description={t(`orders.pod.${state}-description`)}
      />
    </DataTableCard>
  );
}
function PodPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  if (data.refused)
    return (
      <Workspace width="large">
        <PodHeader />
        <WorkspaceContent>
          <Outcome state="refused" />
        </WorkspaceContent>
      </Workspace>
    );
  return (
    <QueryBoundary
      errorComponent={PodLookupError}
      pendingFallback={<PodPending />}
      resetKey="pod-lookups"
    >
      <PodBody
        key={JSON.stringify([
          search.programId,
          search.requestingFacilityId,
          search.supplyingFacilityId,
        ])}
        search={search}
        data={data}
      />
    </QueryBoundary>
  );
}
function PodLookupError(props: { error: unknown; reset: () => void }) {
  return (
    <Workspace width="large">
      <PodHeader />
      <WorkspaceContent>
        <OrdersError {...props} />
      </WorkspaceContent>
    </Workspace>
  );
}
function PodBody({
  search,
  data,
}: {
  search: PodListSearch;
  data: {
    programs: { id: string; name: string | null }[];
    allowed: {
      programIds: string[];
      requestingFacilityIds: string[];
      supplyingFacilityIds: string[];
    };
    refused: boolean;
  };
}) {
  const { data: unsortedFacilities } = useSuspenseQuery(
    viewSupplierFacilitiesOptions([
      ...data.allowed.requestingFacilityIds,
      ...data.allowed.supplyingFacilityIds,
    ]),
  );
  const facilities = unsortedFacilities.toSorted((a, b) =>
    (a.name ?? a.id).localeCompare(b.name ?? b.id),
  );
  const client = useQueryClient();
  const columnView = useCardView(POD_ORDER_HIDEABLE_COLUMNS, 'orders.pod.column-visibility');
  const { updateSearch } = useSearchNavigation<PodListSearch>(NO_DIALOGS);
  const [draft, setDraft] = useState<PodSelection>(search);
  const pending =
    draft.programId !== search.programId ||
    draft.requestingFacilityId !== search.requestingFacilityId ||
    draft.supplyingFacilityId !== search.supplyingFacilityId;
  const ready = canSearchPods(search) && !pending;
  const skeleton = (
    <OrdersTableSkeleton
      kind="pod"
      cards={columnView.cards}
      columns={columnView.columnView.visibility}
      search={search}
    />
  );
  return (
    <Workspace width="large">
      <PodHeader
        facility={facilities.find(({ id }) => id === search.requestingFacilityId)?.name}
        program={data.programs.find(({ id }) => id === search.programId)?.name}
      />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={columnView.measure}>
          <PodSearchPicker
            applied={search}
            requesting={facilities.filter(({ id }) =>
              data.allowed.requestingFacilityIds.includes(id),
            )}
            supplying={facilities.filter(({ id }) =>
              data.allowed.supplyingFacilityIds.includes(id),
            )}
            programs={data.programs}
            onDraftChange={setDraft}
            onSearch={(selection) => {
              if (!pending)
                void client.invalidateQueries({
                  queryKey: ORDER_LISTS_KEY,
                  refetchType: search.page ? 'none' : 'active',
                });
              updateSearch({ ...selection, page: undefined });
            }}
          />
          {ready ? (
            <>
              <DataTableToolbar align="end">
                <div className="flex-1 @2xl/main:flex-none">
                  <OrdersViewOptions
                    kind="pod"
                    columnView={columnView}
                    search={search}
                    onSearchChange={updateSearch}
                  />
                </div>
              </DataTableToolbar>
              <QueryBoundary
                errorComponent={OrdersError}
                pendingFallback={skeleton}
                resetKey={JSON.stringify(toPodParams(search))}
              >
                <OrdersTable
                  kind="pod"
                  cards={columnView.cards}
                  columns={columnView.columnView.visibility}
                  search={search}
                  onSearchChange={updateSearch}
                />
              </QueryBoundary>
            </>
          ) : (
            <Outcome state={pending ? 'pending' : 'pick'} />
          )}
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
