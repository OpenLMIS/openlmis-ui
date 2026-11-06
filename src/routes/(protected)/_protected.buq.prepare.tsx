import { createFileRoute } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import { CalculatorIcon, LockIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { preparedBuqsOptions } from '@/features/buq/api/queries';
import { PrepareBuq, PrepareBuqSkeleton } from '@/features/buq/components/prepare-buq';
import { type PrepareAccess, prepareAccess } from '@/features/buq/lib/access';
import { type PrepareSearch, prepareSearchSchema } from '@/features/buq/lib/search';
import {
  homeFacilityOptions,
  processingSchedulesOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

export const Route = createFileRoute('/(protected)/_protected/buq/prepare')({
  validateSearch: prepareSearchSchema,
  loader: async ({ context: { queryClient } }): Promise<PrepareAccess> => {
    const userId = useLoginData.getState().referenceDataUserId;
    const permissions = await requirePermissions(queryClient, RIGHTS.prepareBuq);
    if (!userId || useLoginData.getState().referenceDataUserId !== userId) {
      throw new ForbiddenError(RIGHTS.prepareBuq);
    }
    const [user, programs] = await Promise.all([
      queryClient.ensureQueryData(userRecordOptions(userId)),
      queryClient.ensureQueryData(userProgramsOptions(userId)),
    ]);
    const home = user.homeFacilityId
      ? await queryClient.ensureQueryData(homeFacilityOptions(user.homeFacilityId))
      : undefined;
    const access = prepareAccess({ home, programs, permissions });
    if (access.kind === 'no-grant') throw new ForbiddenError(RIGHTS.prepareBuq);
    if (access.kind === 'ready') {
      queryClient.prefetchQuery(processingSchedulesOptions());
      queryClient.prefetchQuery(preparedBuqsOptions(access.facility.id));
    }
    return access;
  },
  pendingComponent: PrepareBuqPending,
  component: PrepareBuqPage,
});

function PrepareBuqHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <CalculatorIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('buq.prepare.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('buq.prepare.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

const UNAVAILABLE: Record<Exclude<PrepareAccess['kind'], 'ready' | 'no-grant'>, ParseKeys> = {
  'no-home': 'buq.prepare.no-home',
  'no-program': 'buq.prepare.no-program',
  unsupported: 'buq.prepare.unsupported',
};

function PrepareBuqPage() {
  const { t } = useTranslation();
  const access = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<PrepareSearch>({});
  return (
    <Workspace>
      <PrepareBuqHeader />
      <WorkspaceContent>
        {access.kind === 'ready' ? (
          <PrepareBuq
            facility={access.facility}
            onSearchChange={updateSearch}
            program={access.program}
            search={search}
          />
        ) : (
          access.kind !== 'no-grant' && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LockIcon />
                </EmptyMedia>
                <EmptyTitle>
                  <h2>{t('buq.prepare.unavailable-title')}</h2>
                </EmptyTitle>
                <EmptyDescription>{t(UNAVAILABLE[access.kind])}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function PrepareBuqPending() {
  const search = Route.useSearch();
  return (
    <Workspace>
      <PrepareBuqHeader />
      <WorkspaceContent>
        <PrepareBuqSkeleton search={search} />
      </WorkspaceContent>
    </Workspace>
  );
}
