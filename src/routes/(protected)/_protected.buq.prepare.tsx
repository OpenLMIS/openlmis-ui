import { createFileRoute } from '@tanstack/react-router';
import { format } from 'date-fns';
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
import { buqPeriodsOptions, preparedBuqsOptions } from '@/features/buq/api/queries';
import { PrepareBuq, PrepareBuqSkeleton } from '@/features/buq/components/prepare-buq';
import { BUQ_CODE, type PrepareAccess, prepareAccess } from '@/features/buq/lib/access';
import { type PrepareSearch, prepareSearchSchema } from '@/features/buq/lib/search';
import {
  homeFacilityOptions,
  processingSchedulesOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const noop = () => {};

type ShownAccess = Exclude<PrepareAccess, { kind: 'no-grant' }>;

export const Route = createFileRoute('/(protected)/_protected/buq/prepare')({
  validateSearch: prepareSearchSchema,
  loader: async ({ context: { queryClient }, cause }): Promise<ShownAccess> => {
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) throw new ForbiddenError(RIGHTS.prepareBuq);
    const fresh = cause === 'enter' ? { staleTime: 0 } : {};
    const [permissions, user, programs] = await Promise.all([
      requirePermissions(queryClient, RIGHTS.prepareBuq),
      queryClient.fetchQuery({ ...userRecordOptions(userId), ...fresh }),
      queryClient.fetchQuery({ ...userProgramsOptions(userId), ...fresh }),
    ]);
    if (useLoginData.getState().referenceDataUserId !== userId) {
      throw new ForbiddenError(RIGHTS.prepareBuq);
    }
    const home = user.homeFacilityId
      ? await queryClient.fetchQuery({ ...homeFacilityOptions(user.homeFacilityId), ...fresh })
      : undefined;
    const access = prepareAccess({
      home,
      programs,
      permissions,
      today: format(new Date(), 'yyyy-MM-dd'),
    });
    if (access.kind === 'no-grant') throw new ForbiddenError(RIGHTS.prepareBuq);
    if (access.kind === 'ready') {
      void queryClient.fetchQuery(processingSchedulesOptions()).then((schedules) => {
        const schedule = schedules.find(({ code }) => code === BUQ_CODE);
        return queryClient.prefetchQuery(buqPeriodsOptions(schedule?.id));
      }, noop);
      if (cause !== 'preload') queryClient.prefetchQuery(preparedBuqsOptions(access.facility.id));
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

const UNAVAILABLE: Record<Exclude<ShownAccess['kind'], 'ready'>, ParseKeys> = {
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
