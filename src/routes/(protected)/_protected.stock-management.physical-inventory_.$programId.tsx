import { createFileRoute, Link } from '@tanstack/react-router';
import { ClipboardListIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableEmpty } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { WorkspaceSlots } from '@/components/workspace-tabs';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  facilityOptions,
  userRecordOptions,
  validReasonsOptions,
} from '@/features/reference-data/api/queries';
import {
  eligibleInventoryProductsOptions,
  inventoryStockLinesOptions,
  inventorySummariesOptions,
  physicalInventoryDraftOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { PhysicalInventoryEditor } from '@/features/stock-events/components/physical-inventory-editor';
import {
  type InventorySearch,
  inventorySearchSchema,
} from '@/features/stock-events/lib/physical-inventory-search';
import { useReloadForUser } from '@/hooks/use-reload-for-user';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { recordLabel } from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import { hasProgramGrant } from '@/lib/permissions';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/physical-inventory_/$programId',
)({
  validateSearch: inventorySearchSchema,
  preload: false,
  staticData: { crumbKey: 'physical-inventory.editor-crumb' },
  loader: async ({ context: { queryClient }, params: { programId }, cause }) => {
    const session = getSessionScope();
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) throw new ForbiddenError(RIGHTS.stockInventoriesEdit);
    const [permissions, user] = await Promise.all([
      requirePermissions(queryClient, RIGHTS.stockInventoriesEdit),
      queryClient.ensureQueryData(userRecordOptions(userId)),
    ]);
    assertSessionScope(session);
    const homeId = user.homeFacilityId;
    if (!homeId || !hasProgramGrant(permissions, RIGHTS.stockInventoriesEdit, homeId, programId))
      throw new ForbiddenError(RIGHTS.stockInventoriesEdit);
    const homeFacility = await queryClient.ensureQueryData(facilityOptions(homeId));
    assertSessionScope(session);
    const program = homeFacility.supportedPrograms?.find((program) => program.id === programId);
    if (!program) throw new ForbiddenError(RIGHTS.stockInventoriesEdit);
    const selection = { facilityId: homeId, programId };
    const canViewStock = hasProgramGrant(permissions, RIGHTS.stockCardsView, homeId, programId);
    const summaries: Promise<unknown> =
      canViewStock && cause === 'enter'
        ? queryClient.fetchQuery({ ...inventorySummariesOptions(selection), staleTime: 0 })
        : Promise.resolve();
    if (canViewStock) {
      void summaries
        .then(() =>
          queryClient.prefetchQuery({
            ...eligibleInventoryProductsOptions(selection),
            ...(cause === 'enter' && { staleTime: 0 }),
          }),
        )
        .catch(() => undefined);
      queryClient.prefetchQuery(
        validReasonsOptions({ program: programId, facilityType: homeFacility.type.id }),
      );
    }
    const options = physicalInventoryDraftOptions(selection);
    const [draft] = await Promise.all([
      cause === 'enter'
        ? queryClient.fetchQuery({ ...options, staleTime: 0 })
        : queryClient.ensureQueryData(options),
      summaries,
    ]);
    assertSessionScope(session);
    if (draft && canViewStock) {
      if (cause === 'enter')
        await queryClient.fetchQuery({ ...inventoryStockLinesOptions(draft), staleTime: 0 });
      else await queryClient.ensureQueryData(inventoryStockLinesOptions(draft));
      assertSessionScope(session);
    }
    return {
      userId,
      homeFacility,
      program,
      draft,
      canViewStock,
      canManageLots: permissions.rights.has(RIGHTS.lotsManage),
    };
  },
  pendingComponent: InventoryPending,
  component: InventoryPage,
});

function InventoryPage() {
  const { t } = useTranslation();
  const { userId, homeFacility, program, draft, canViewStock, canManageLots } =
    Route.useLoaderData();
  const currentUser = useReloadForUser(userId, queryKeys.physicalInventories.all);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const username = useLoginData((state) => state.username) ?? '';
  const { updateSearch } = useSearchNavigation<InventorySearch>({});
  if (currentUser !== userId) return <InventoryPending />;
  return (
    <WorkspaceSlots>
      <Workspace>
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <ClipboardListIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>
              {t('physical-inventory.editor-title', {
                code: homeFacility.code,
                facility: recordLabel(homeFacility),
                program: recordLabel(program),
              })}
            </WorkspaceTitle>
            <WorkspaceDescription>
              {t('physical-inventory.editor-description')}
            </WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          {draft ? (
            canViewStock ? (
              <PhysicalInventoryEditor
                key={draft.id}
                draft={draft}
                right={RIGHTS.stockInventoriesEdit}
                userId={userId}
                username={username}
                onDeleted={() => navigate({ to: '/stock-management/physical-inventory' })}
                onSubmitted={() =>
                  navigate({
                    to: '/stock-management/stock-on-hand',
                    search: { mode: 'my', facilityId: homeFacility.id, programId: program.id },
                  })
                }
                facilityTypeId={homeFacility.type.id}
                canManageLots={canManageLots}
                search={search}
                onSearchChange={updateSearch}
              />
            ) : (
              <DataTableEmpty
                title={t('physical-inventory.no-stock-view-title')}
                description={t('physical-inventory.no-stock-view-description', {
                  right: t('rights.stock-cards-view'),
                })}
              />
            )
          ) : (
            <DataTableEmpty
              title={t('physical-inventory.no-draft-title')}
              description={t('physical-inventory.no-draft-description')}
              action={
                <Button
                  nativeButton={false}
                  render={<Link to="/stock-management/physical-inventory" />}
                >
                  {t('physical-inventory.back')}
                </Button>
              }
            />
          )}
        </WorkspaceContent>
      </Workspace>
    </WorkspaceSlots>
  );
}

function InventoryPending() {
  return (
    <Workspace>
      <WorkspaceHeader>
        <div className="h-6 w-96 max-w-full">
          <Skeleton fill />
        </div>
      </WorkspaceHeader>
      <WorkspaceContent>{null}</WorkspaceContent>
    </Workspace>
  );
}
