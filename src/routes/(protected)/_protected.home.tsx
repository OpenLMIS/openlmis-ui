import { useIsFetching, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace';
import { rightsOptions } from '@/features/auth/api/queries';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  approvalsOptions,
  convertCountOptions,
  equipmentStatusCountsOptions,
  firstNameOptions,
  openOrdersCountOptions,
  recentRequisitionsOptions,
  requisitionStatusCountsOptions,
  systemNotificationsOptions,
} from '@/features/home/api/queries';
import { WaitingSummary, WelcomeTitle } from '@/features/home/components/dashboard-greeting';
import { ActionsSkeleton, DashboardSkeleton } from '@/features/home/components/dashboard-skeleton';
import { HomeDashboard } from '@/features/home/components/home-dashboard';
import type { DashboardAccess } from '@/features/home/lib/access';
import { queryKeys } from '@/lib/key-factory';

/** Each part of the dashboard needs the right its legacy page asks for. */
function toAccess(rights: ReadonlySet<string>): DashboardAccess {
  return {
    approve: rights.has(RIGHTS.requisitionApprove),
    convert: rights.has(RIGHTS.ordersEdit),
    orders: rights.has(RIGHTS.ordersView) || rights.has(RIGHTS.podsManage),
    equipment: rights.has(RIGHTS.cceInventoryView),
    requisitions: rights.has(RIGHTS.requisitionView),
  };
}

export const Route = createFileRoute('/(protected)/_protected/home')({
  loader: async ({ context: { queryClient } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) return;
    queryClient.prefetchQuery(firstNameOptions(userId));
    queryClient.prefetchQuery(systemNotificationsOptions());

    // What to load depends on the user's rights, so the page waits for those, as for any permission check.
    const access = toAccess(await queryClient.ensureQueryData(rightsOptions(userId)));
    if (access.approve) queryClient.prefetchQuery(approvalsOptions());
    if (access.convert) queryClient.prefetchQuery(convertCountOptions());
    if (access.orders) queryClient.prefetchQuery(openOrdersCountOptions());
    if (access.equipment) queryClient.prefetchQuery(equipmentStatusCountsOptions());
    if (access.requisitions) {
      queryClient.prefetchQuery(recentRequisitionsOptions());
      queryClient.prefetchQuery(requisitionStatusCountsOptions());
    }
  },
  pendingComponent: HomePending,
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const userId = useLoginData((state) => state.referenceDataUserId) ?? '';
  const { data: rights } = useSuspenseQuery(rightsOptions(userId));
  const access = toAccess(rights);

  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>
            <QueryBoundary
              errorComponent={() => t('home.title')}
              pendingFallback={t('home.title')}
              resetKey={userId}
            >
              <WelcomeTitle userId={userId} />
            </QueryBoundary>
          </WorkspaceTitle>
          <WorkspaceDescription>
            <QueryBoundary
              errorComponent={() => t('home.description')}
              pendingFallback={t('home.description')}
              resetKey={userId}
            >
              <WaitingSummary canApprove={access.approve} canConvert={access.convert} />
            </QueryBoundary>
          </WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <RefreshButton />
          {rights.has(RIGHTS.usersManage) && (
            <Button
              nativeButton={false}
              render={<Link search={{ user: 'new' }} to="/administration/users" />}
              size="lg"
            >
              <PlusIcon data-icon="inline-start" />
              {t('home.add-user')}
            </Button>
          )}
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <HomeDashboard access={access} />
      </WorkspaceContent>
    </Workspace>
  );
}

/** Reloads every number on the page; spins while any of them is still loading. */
function RefreshButton() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: queryKeys.home.all }) > 0;

  return (
    <Button
      disabled={isFetching}
      onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.home.all })}
      size="lg"
      type="button"
      variant="outline"
    >
      <RefreshCwIcon className={isFetching ? 'animate-spin' : undefined} data-icon="inline-start" />
      {t('home.refresh')}
    </Button>
  );
}

/** While the rights load, the dashboard's own layout with placeholder values. */
function HomePending() {
  const { t } = useTranslation();

  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('home.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('home.description')}</WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <ActionsSkeleton />
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <DashboardSkeleton />
      </WorkspaceContent>
    </Workspace>
  );
}
