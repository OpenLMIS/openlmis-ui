import { useQuery, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, Link } from '@tanstack/react-router';
import { ClipboardPenLineIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadError } from '@/components/load-error';
import { NoAccess } from '@/components/no-access-page';
import { QueryBoundary } from '@/components/query-boundary';
import {
  StockProgramPicker,
  StockProgramPickerSkeleton,
} from '@/components/stock-program-picker/stock-program-picker';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { ForbiddenError, isForbidden, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  facilityOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { type NamedRecord, recordLabel } from '@/lib/facility-program-selection';
import { type ProgramGrant, programGrants } from '@/lib/permissions';
import { homeStockPrograms } from '@/lib/stock-programs';

export const Route = createFileRoute('/(protected)/_protected/stock-management/adjustments')({
  loader: async ({ context: { queryClient } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const permissions = await requirePermissions(queryClient, RIGHTS.stockAdjust);
    if (!userId || useLoginData.getState().referenceDataUserId !== userId) {
      throw new ForbiddenError(RIGHTS.stockAdjust);
    }
    queryClient.prefetchQuery(userProgramsOptions(userId));
    queryClient.prefetchQuery(userRecordOptions(userId)).then(() => {
      const user = queryClient.getQueryData(userRecordOptions(userId).queryKey);
      if (user?.homeFacilityId && useLoginData.getState().referenceDataUserId === userId) {
        queryClient.prefetchQuery(facilityOptions(user.homeFacilityId));
      }
    });
    return { userId, permissions };
  },
  pendingComponent: AdjustmentsPending,
  component: AdjustmentsPage,
});

function AdjustmentsHeader({ userId }: { userId?: string }) {
  const { t } = useTranslation();
  const { data: user } = useQuery({ ...userRecordOptions(userId ?? ''), enabled: Boolean(userId) });
  const homeId = user?.homeFacilityId;
  const { data: home } = useQuery({ ...facilityOptions(homeId ?? ''), enabled: Boolean(homeId) });
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardPenLineIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>
          {home
            ? t('stock-adjustment.title', { facility: recordLabel(home) })
            : t('nav.stock-management.adjustments')}
        </WorkspaceTitle>
        <WorkspaceDescription>{t('stock-adjustment.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function AdjustmentsPage() {
  const { userId } = Route.useLoaderData();
  return (
    <Workspace>
      <AdjustmentsHeader userId={userId} />
      <WorkspaceContent>
        <QueryBoundary
          errorComponent={ProgramsError}
          pendingFallback={<StockProgramPickerSkeleton />}
          resetKey={userId}
        >
          <AdjustmentPrograms />
        </QueryBoundary>
      </WorkspaceContent>
    </Workspace>
  );
}

function AdjustmentPrograms() {
  const { userId, permissions } = Route.useLoaderData();
  const [user, programs] = useSuspenseQueries({
    queries: [userRecordOptions(userId), userProgramsOptions(userId)],
  });
  if (!user.data.homeFacilityId) return <ProgramsTable hasHomeFacility={false} programs={[]} />;
  return (
    <HomePrograms
      grants={programGrants(permissions, RIGHTS.stockAdjust)}
      homeId={user.data.homeFacilityId}
      programs={programs.data}
    />
  );
}

function HomePrograms({
  homeId,
  ...sources
}: {
  homeId: string;
  programs: readonly NamedRecord[];
  grants: readonly ProgramGrant[];
}) {
  const { data: homeFacility } = useSuspenseQuery(facilityOptions(homeId));
  return (
    <ProgramsTable hasHomeFacility programs={homeStockPrograms({ homeFacility, ...sources })} />
  );
}

function ProgramsTable({
  hasHomeFacility,
  programs,
}: {
  hasHomeFacility: boolean;
  programs: readonly NamedRecord[];
}) {
  const { t } = useTranslation();
  return (
    <StockProgramPicker
      actionLabel={t('stock-adjustment.make')}
      hasHomeFacility={hasHomeFacility}
      linkFor={(row) => (
        <Link params={{ programId: row.id }} to="/stock-management/adjustments/$programId" />
      )}
      rows={programs.map((program) => ({ id: program.id, label: recordLabel(program) }))}
    />
  );
}

function ProgramsError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  if (isForbidden(error)) return <NoAccess />;
  return (
    <LoadError
      description={t('stock-programs.load-error')}
      error={error}
      reset={reset}
      title={t('stock-programs.load-error-title')}
    />
  );
}

function AdjustmentsPending() {
  return (
    <Workspace>
      <AdjustmentsHeader />
      <WorkspaceContent>
        <StockProgramPickerSkeleton />
      </WorkspaceContent>
    </Workspace>
  );
}
