import { createFileRoute } from '@tanstack/react-router';
import { ClipboardPenLineIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  facilityOptions,
  userProgramsOptions,
  userRecordOptions,
  validReasonsOptions,
} from '@/features/reference-data/api/queries';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import {
  AdjustmentEditor,
  type AdjustmentSearch,
} from '@/features/stock-events/components/adjustment-editor';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { recordLabel } from '@/lib/facility-program-selection';
import { hasProgramGrant } from '@/lib/permissions';
import { tableSearchSchema, textFilterSchema } from '@/lib/table-search';

const searchSchema = tableSearchSchema(['id'])
  .pick({ page: true, size: true })
  .extend({
    keyword: textFilterSchema,
  })
  .transform((search) => ({
    ...search,
    page: search.page === 1 ? undefined : search.page,
    size: search.size === 10 ? undefined : search.size,
  }));

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/adjustments_/$programId',
)({
  validateSearch: searchSchema,
  staticData: { crumbKey: 'stock-adjustment.editor-crumb' },
  loader: async ({ context: { queryClient }, params: { programId } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const permissions = await requirePermissions(queryClient, RIGHTS.stockAdjust);
    if (!userId || useLoginData.getState().referenceDataUserId !== userId) {
      throw new ForbiddenError(RIGHTS.stockAdjust);
    }
    const user = await queryClient.ensureQueryData(userRecordOptions(userId));
    const homeId = user.homeFacilityId;
    if (!homeId || !hasProgramGrant(permissions, RIGHTS.stockAdjust, homeId, programId)) {
      throw new ForbiddenError(RIGHTS.stockAdjust);
    }
    const homeFacility = await queryClient.ensureQueryData(facilityOptions(homeId));
    const program = homeFacility.supportedPrograms?.find((program) => program.id === programId);
    if (!program || useLoginData.getState().referenceDataUserId !== userId) {
      throw new ForbiddenError(RIGHTS.stockAdjust);
    }
    queryClient.prefetchQuery(userProgramsOptions(userId));
    const canViewStock = hasProgramGrant(permissions, RIGHTS.stockCardsView, homeId, programId);
    if (canViewStock) {
      queryClient.prefetchQuery(eventStockCardsOptions({ facilityId: homeId, programId }));
      queryClient.prefetchQuery(
        validReasonsOptions({ program: programId, facilityType: homeFacility.type.id }),
      );
    }
    return { homeFacility, program, canViewStock };
  },
  pendingComponent: AdjustmentPending,
  component: AdjustmentPage,
});

function AdjustmentPage() {
  const { t } = useTranslation();
  const { homeFacility, program, canViewStock } = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<AdjustmentSearch>({});
  const navigate = Route.useNavigate();
  const username = useLoginData((state) => state.username) ?? '';
  return (
    <AdjustmentEditor
      key={`${homeFacility.id}/${program.id}`}
      facilityId={homeFacility.id}
      facilityTypeId={homeFacility.type.id}
      programId={program.id}
      username={username}
      canViewStock={canViewStock}
      search={search}
      onSearchChange={updateSearch}
      onSubmitted={() =>
        navigate({
          to: '/stock-management/stock-on-hand',
          search: { mode: 'my', facilityId: homeFacility.id, programId: program.id },
        })
      }
    >
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ClipboardPenLineIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>
            {t('stock-adjustment.editor-title', {
              code: homeFacility.code,
              facility: recordLabel(homeFacility),
              program: recordLabel(program),
            })}
          </WorkspaceTitle>
          <WorkspaceDescription>{t('stock-adjustment.editor-description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
    </AdjustmentEditor>
  );
}

function AdjustmentPending() {
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
