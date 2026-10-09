import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { ClipboardPenLineIcon } from 'lucide-react';
import type { ReactElement } from 'react';
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
import { type Permissions, type ProgramGrant, programGrants } from '@/lib/permissions';
import { homeStockPrograms } from '@/lib/stock-programs';

export async function loadStockEventPrograms(queryClient: QueryClient) {
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
}
function ProgramsHeader({ userId, copy }: { userId?: string; copy: PickerCopy }) {
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
          {home ? t(copy.title, { facility: recordLabel(home) }) : t(copy.nav)}
        </WorkspaceTitle>
        <WorkspaceDescription>{t(copy.description)}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

type PickerCopy = {
  title: 'stock-adjustment.title' | 'stock-issue.title';
  nav: 'nav.stock-management.adjustments' | 'nav.stock-management.issue';
  description: 'stock-adjustment.page-description' | 'stock-issue.page-description';
  action: 'stock-adjustment.make' | 'stock-issue.make';
};
type PickerProps = {
  userId: string;
  permissions: Permissions;
  copy: PickerCopy;
  editorLink: (programId: string) => ReactElement;
};
export function StockEventProgramPicker({ userId, permissions, copy, editorLink }: PickerProps) {
  return (
    <Workspace width="narrow">
      <ProgramsHeader userId={userId} copy={copy} />
      <WorkspaceContent>
        <QueryBoundary
          errorComponent={ProgramsError}
          pendingFallback={<StockProgramPickerSkeleton />}
          resetKey={userId}
        >
          <EventPrograms
            userId={userId}
            permissions={permissions}
            action={copy.action}
            editorLink={editorLink}
          />
        </QueryBoundary>
      </WorkspaceContent>
    </Workspace>
  );
}

type ProgramTableProps = {
  action: PickerCopy['action'];
  editorLink: PickerProps['editorLink'];
};
function EventPrograms({
  userId,
  permissions,
  ...table
}: Omit<PickerProps, 'copy'> & ProgramTableProps) {
  const [user, programs] = useSuspenseQueries({
    queries: [userRecordOptions(userId), userProgramsOptions(userId)],
  });
  if (!user.data.homeFacilityId)
    return <ProgramsTable {...table} hasHomeFacility={false} programs={[]} />;
  return (
    <HomePrograms
      {...table}
      grants={programGrants(permissions, RIGHTS.stockAdjust)}
      homeId={user.data.homeFacilityId}
      programs={programs.data}
    />
  );
}

function HomePrograms({
  homeId,
  action,
  editorLink,
  ...sources
}: ProgramTableProps & {
  homeId: string;
  programs: readonly NamedRecord[];
  grants: readonly ProgramGrant[];
}) {
  const { data: homeFacility } = useSuspenseQuery(facilityOptions(homeId));
  return (
    <ProgramsTable
      action={action}
      editorLink={editorLink}
      hasHomeFacility
      programs={homeStockPrograms({ homeFacility, ...sources })}
    />
  );
}

function ProgramsTable({
  hasHomeFacility,
  programs,
  action,
  editorLink,
}: ProgramTableProps & {
  hasHomeFacility: boolean;
  programs: readonly NamedRecord[];
}) {
  const { t } = useTranslation();
  return (
    <StockProgramPicker
      actionLabel={t(action)}
      hasHomeFacility={hasHomeFacility}
      linkFor={(row) => editorLink(row.id)}
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

export function StockEventProgramsPending({ copy }: { copy: PickerCopy }) {
  return (
    <Workspace width="narrow">
      <ProgramsHeader copy={copy} />
      <WorkspaceContent>
        <StockProgramPickerSkeleton />
      </WorkspaceContent>
    </Workspace>
  );
}
