import { useIsFetching, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { DashboardRevision } from '@/features/home/components/dashboard-parts';
import { ActionsSkeleton, DashboardSkeleton } from '@/features/home/components/dashboard-skeleton';
import { HomeDashboard, preloadCharts } from '@/features/home/components/home-dashboard';
import type { DashboardAccess } from '@/features/home/lib/types';
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
      preloadCharts();
      queryClient.prefetchQuery(recentRequisitionsOptions());
      queryClient.prefetchQuery(requisitionStatusCountsOptions());
    }
  },
  pendingComponent: HomePending,
  component: HomePage,
});

function HomePage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  // Signing out clears the cache before leaving, so the page must not load rights for no one.
  return userId ? <HomeContent userId={userId} /> : null;
}

function HomeContent({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: rights } = useSuspenseQuery(rightsOptions(userId));
  const access = toAccess(rights);
  const [revision, setRevision] = useState(0);

  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>
            <WelcomeTitle userId={userId} />
          </WorkspaceTitle>
          <WorkspaceDescription>
            <WaitingSummary canApprove={access.approve} canConvert={access.convert} />
          </WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <RefreshButton onRefresh={() => setRevision((current) => current + 1)} userId={userId} />
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
        <DashboardRevision value={revision}>
          <HomeDashboard access={access} />
        </DashboardRevision>
      </WorkspaceContent>
    </Workspace>
  );
}

/** Reloads every number and the user's rights; cards that had failed mount again and retry. */
function RefreshButton({ userId, onRefresh }: { userId: string; onRefresh: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: queryKeys.home.all }) > 0;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: rightsOptions(userId).queryKey });
    void queryClient.resetQueries({ queryKey: queryKeys.home.all });
    onRefresh();
  };

  return (
    <Button disabled={isFetching} onClick={refresh} size="lg" type="button" variant="outline">
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
