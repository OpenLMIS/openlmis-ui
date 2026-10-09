import type { QueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Workspace, WorkspaceContent, WorkspaceHeader } from '@/components/workspace';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  facilityOptions,
  userProgramsOptions,
  userRecordOptions,
  validDestinationsOptions,
  validReasonsOptions,
} from '@/features/reference-data/api/queries';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import { hasProgramGrant } from '@/lib/permissions';
import { tableSearchSchema, textFilterSchema } from '@/lib/table-search';

export const stockEventSearchSchema = tableSearchSchema(['id'])
  .pick({ page: true, size: true })
  .extend({
    keyword: textFilterSchema,
  })
  .transform((search) => ({
    ...search,
    page: search.page === 1 ? undefined : search.page,
    size: search.size === 10 ? undefined : search.size,
  }));

export async function loadStockEventEditor(
  queryClient: QueryClient,
  programId: string,
  { destinations }: { destinations: boolean },
) {
  const userId = useLoginData.getState().referenceDataUserId;
  const permissions = await requirePermissions(queryClient, RIGHTS.stockAdjust);
  if (!userId) {
    throw new ForbiddenError(RIGHTS.stockAdjust);
  }
  const user = await queryClient.ensureQueryData(userRecordOptions(userId));
  const homeId = user.homeFacilityId;
  if (!homeId || !hasProgramGrant(permissions, RIGHTS.stockAdjust, homeId, programId)) {
    throw new ForbiddenError(RIGHTS.stockAdjust);
  }
  const homeFacility = await queryClient.ensureQueryData(facilityOptions(homeId));
  const program = homeFacility.supportedPrograms?.find((program) => program.id === programId);
  if (!program) {
    throw new ForbiddenError(RIGHTS.stockAdjust);
  }
  queryClient.prefetchQuery(userProgramsOptions(userId));
  const canViewStock = hasProgramGrant(permissions, RIGHTS.stockCardsView, homeId, programId);
  if (canViewStock) {
    if (destinations)
      queryClient.prefetchQuery(validDestinationsOptions({ facilityId: homeId, programId }));
    queryClient.prefetchQuery(eventStockCardsOptions({ facilityId: homeId, programId }));
    queryClient.prefetchQuery(
      validReasonsOptions({ program: programId, facilityType: homeFacility.type.id }),
    );
  }
  return { userId, homeFacility, program, canViewStock };
}

export function StockEventPending({ width = 'default' }: { width?: 'default' | 'wide' }) {
  return (
    <Workspace width={width}>
      <WorkspaceHeader>
        <div className="h-6 w-96 max-w-full">
          <Skeleton fill />
        </div>
      </WorkspaceHeader>
      <WorkspaceContent>{null}</WorkspaceContent>
    </Workspace>
  );
}
