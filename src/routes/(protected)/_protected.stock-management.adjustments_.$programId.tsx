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
} from '@/features/reference-data/api/queries';
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
    return { homeFacility, program, permissions };
  },
  pendingComponent: AdjustmentPending,
  component: AdjustmentPage,
});

function AdjustmentPage() {
  const { t } = useTranslation();
  const { homeFacility, program } = Route.useLoaderData();
  return (
    <Workspace>
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
      <WorkspaceContent>{null}</WorkspaceContent>
    </Workspace>
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
