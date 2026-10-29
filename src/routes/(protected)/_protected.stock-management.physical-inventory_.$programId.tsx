import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { ClipboardListIcon, WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { DataTableCard, DataTableEmpty } from '@/components/data-table/data-table';
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
} from '@/components/workspace/workspace';
import { WorkspaceSlots } from '@/components/workspace/workspace-tabs';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  deploymentTimeZoneOptions,
  homeFacilityOptions,
  userRecordOptions,
  validReasonsOptions,
} from '@/features/reference-data/api/queries';
import {
  eligibleInventoryProductsOptions,
  inventoryStockLinesOptions,
  inventorySummariesOptions,
  physicalInventoryDraftOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { InventoryOrphans } from '@/features/stock-events/components/inventory-orphans';
import { PhysicalInventoryEditor } from '@/features/stock-events/components/physical-inventory-editor';
import { PhysicalInventoryPendingBody } from '@/features/stock-events/components/physical-inventory-pending';
import { inventorySavePayload } from '@/features/stock-events/lib/physical-inventory-form';
import { readInventoryLocalByScope } from '@/features/stock-events/lib/physical-inventory-local';
import {
  type InventorySearch,
  inventorySearchSchema,
} from '@/features/stock-events/lib/physical-inventory-search';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useReloadForUser } from '@/hooks/use-reload-for-user';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { type NamedRecord, recordLabel } from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import { deviceDataGeneration } from '@/lib/local-data';
import { isOnline, useOnReconnect } from '@/lib/online';
import { hasProgramGrant } from '@/lib/permissions';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/physical-inventory_/$programId',
)({
  validateSearch: inventorySearchSchema,
  preload: false,
  shouldReload: ({ cause }) => cause === 'enter',
  staticData: { crumbKey: 'physical-inventory.editor-crumb' },
  loader: {
    staleReloadMode: 'blocking',
    handler: async ({ context: { queryClient }, params: { programId }, cause }) => {
      queryClient.prefetchQuery(deploymentTimeZoneOptions());
      const eligibleUpdatedAfter = cause === 'enter' ? Date.now() : 0;
      const session = getSessionScope();
      const userId = useLoginData.getState().referenceDataUserId;
      if (!userId) throw new ForbiddenError(RIGHTS.stockInventoriesEdit);
      const [permissions, user] = await Promise.all([
        requirePermissions(queryClient, RIGHTS.stockInventoriesEdit),
        queryClient.fetchQuery(userRecordOptions(userId)),
      ]);
      assertSessionScope(session);
      const homeId = user.homeFacilityId;
      if (!homeId || !hasProgramGrant(permissions, RIGHTS.stockInventoriesEdit, homeId, programId))
        throw new ForbiddenError(RIGHTS.stockInventoriesEdit);
      const homeFacility = await queryClient.fetchQuery(homeFacilityOptions(homeId));
      assertSessionScope(session);
      const program = homeFacility.supportedPrograms?.find((program) => program.id === programId);
      if (!program) throw new ForbiddenError(RIGHTS.stockInventoriesEdit);
      const selection = { facilityId: homeId, programId };
      const canViewStock = hasProgramGrant(permissions, RIGHTS.stockCardsView, homeId, programId);
      const fromDevice = async () => {
        const deviceCopy = await readInventoryLocalByScope(selection);
        assertSessionScope(session);
        const base = {
          eligibleUpdatedAfter: 0,
          userId,
          homeFacility,
          program,
          canViewStock,
          canManageLots: permissions.rights.has(RIGHTS.lotsManage),
        };
        if (!deviceCopy) return { ...base, deviceCopy: undefined, draft: null, missingCopy: true };
        return {
          ...base,
          deviceCopy,
          draft: inventorySavePayload(
            { id: deviceCopy.draftId, ...selection, lineItems: [] },
            deviceCopy.lines,
            [],
          ),
          missingCopy: false,
        };
      };
      if (!isOnline()) return fromDevice();
      if (canViewStock) {
        void queryClient
          .prefetchQuery({
            ...inventorySummariesOptions(selection, eligibleUpdatedAfter),
            ...(cause === 'enter' && { staleTime: 0 }),
          })
          .then(() => {
            if (
              getSessionScope() !== session ||
              queryClient.getQueryState(inventorySummariesOptions(selection).queryKey)?.status !==
                'success'
            )
              return;
            queryClient.prefetchQuery(
              eligibleInventoryProductsOptions(selection, eligibleUpdatedAfter),
            );
          });
        queryClient.prefetchQuery(
          validReasonsOptions({ program: programId, facilityType: homeFacility.type.id }),
        );
      }
      const options = physicalInventoryDraftOptions(selection);
      const draft =
        cause === 'enter'
          ? await queryClient.fetchQuery({ ...options, staleTime: 0 })
          : await queryClient.ensureQueryData(options);
      assertSessionScope(session);
      if (deviceDataGeneration(draft) !== undefined || !isOnline()) return fromDevice();
      if (draft && canViewStock) {
        queryClient.prefetchQuery({
          ...inventoryStockLinesOptions(draft, eligibleUpdatedAfter),
          ...(cause === 'enter' && { staleTime: 0 }),
        });
      }
      return {
        deviceCopy: undefined,
        eligibleUpdatedAfter,
        userId,
        homeFacility,
        program,
        draft,
        canViewStock,
        canManageLots: permissions.rights.has(RIGHTS.lotsManage),
        missingCopy: false,
      };
    },
  },
  errorComponent: ErrorFallback,
  pendingComponent: InventoryPending,
  component: InventoryPage,
});

function InventoryPage() {
  const { t } = useTranslation();
  const {
    userId,
    homeFacility,
    program,
    draft,
    canViewStock,
    canManageLots,
    eligibleUpdatedAfter,
    deviceCopy,
    missingCopy,
  } = Route.useLoaderData();
  const router = useRouter();
  useOnReconnect(() => {
    if (missingCopy) void router.invalidate();
  });
  const currentUser = useReloadForUser(userId, queryKeys.physicalInventories.all);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const username = useLoginData((state) => state.username) ?? '';
  const { updateSearch } = useSearchNavigation<InventorySearch>({});
  if (currentUser !== userId) return <InventoryPending />;
  return (
    <WorkspaceSlots>
      <Workspace width="wide">
        <EditorHeader home={homeFacility} program={program} />
        <WorkspaceContent>
          <InventoryOrphans scope={{ facilityId: homeFacility.id, programId: program.id }} />
          {missingCopy ? (
            <DataTableCard>
              <DataTableEmpty
                icon={<WifiOffIcon />}
                title={t('physical-inventory.not-on-device')}
                description={t('physical-inventory.not-on-device-description')}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link to="/stock-management/physical-inventory" />}
                  >
                    {t('physical-inventory.back')}
                  </Button>
                }
              />
            </DataTableCard>
          ) : draft ? (
            canViewStock ? (
              <PhysicalInventoryEditor
                key={draft.id}
                draft={draft}
                deviceCopy={deviceCopy}
                eligibleUpdatedAfter={eligibleUpdatedAfter}
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
  const { programId } = Route.useParams();
  const search = Route.useSearch();
  const quantityUnit = useQuantityUnit();
  const userId = useLoginData((state) => state.referenceDataUserId);
  const { data: user } = useQuery({ ...userRecordOptions(userId ?? ''), enabled: false });
  const { data: home } = useQuery({
    ...homeFacilityOptions(user?.homeFacilityId ?? ''),
    enabled: false,
  });
  const program = home?.supportedPrograms?.find((item) => item.id === programId);
  const { data: draft } = useQuery({
    ...physicalInventoryDraftOptions({ facilityId: home?.id ?? '', programId }),
    enabled: false,
  });
  return (
    <WorkspaceSlots>
      <Workspace width="wide">
        <EditorHeader home={home} program={program} />
        <WorkspaceContent>
          <PhysicalInventoryPendingBody
            search={search}
            quantityUnit={quantityUnit}
            draft={draft ?? undefined}
          />
        </WorkspaceContent>
      </Workspace>
    </WorkspaceSlots>
  );
}

function EditorHeader({
  home,
  program,
}: {
  home?: NamedRecord & { code: string };
  program?: NamedRecord;
}) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardListIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>
          {home && program ? (
            t('physical-inventory.editor-title', {
              code: home.code,
              facility: recordLabel(home),
              program: recordLabel(program),
            })
          ) : (
            <span className="block h-10 w-64 max-w-full @xl/main:h-5 @xl/main:w-3xl">
              <Skeleton fill />
            </span>
          )}
        </WorkspaceTitle>
        <WorkspaceDescription>{t('physical-inventory.editor-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
