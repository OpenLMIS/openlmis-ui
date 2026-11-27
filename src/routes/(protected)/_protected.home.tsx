import { useIsFetching, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PlusIcon, RefreshCwIcon } from 'lucide-react';
import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canOpen, useRouteRightsLookup } from '@/components/app-shell/nav-access';
import { ActionTooltip } from '@/components/shared/action-tooltip';
import { Button } from '@/components/ui/button';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { permissionsOptions, rightsOptions } from '@/features/auth/api/queries';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  approvalsOptions,
  convertCountOptions,
  equipmentStatusCountsOptions,
  openOrdersCountOptions,
  recentRequisitionsOptions,
  requisitionStatusCountsOptions,
} from '@/features/home/api/queries';
import { WaitingSummary, WelcomeTitle } from '@/features/home/components/dashboard-greeting';
import { DashboardRevision } from '@/features/home/components/dashboard-parts';
import { ActionsSkeleton, DashboardSkeleton } from '@/features/home/components/dashboard-skeleton';
import { HomeDashboard, preloadCharts } from '@/features/home/components/home-dashboard';
import type { DashboardAccess } from '@/features/home/lib/types';
import { userRecordOptions } from '@/features/reference-data/api/queries';
import { HomeReport } from '@/features/reports/components/home-report';
import { systemNotificationsOptions } from '@/features/system-notifications/api/queries';
import { cancelHomeQueries } from '@/lib/home-navigation';
import { homeReportQueryKey, queryKeys, userRecordKey } from '@/lib/key-factory';
import { isOnline, useOnline } from '@/lib/online';

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
    queryClient.prefetchQuery(userRecordOptions(userId));

    // What to load depends on the user's rights, so the page waits for those, as for any permission check.
    const access = toAccess((await queryClient.fetchQuery(permissionsOptions(userId))).rights);
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
  onLeave: ({ context: { queryClient } }) => {
    cancelHomeQueries(queryClient);
  },
  pendingComponent: HomePending,
  component: HomePage,
});

function HomePage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  const username = useLoginData((state) => state.username);
  // Signing out clears the cache before leaving, so the page must not load rights for no one.
  return userId ? <HomeContent userId={userId} username={username ?? ''} /> : null;
}

function HomeContent({ userId, username }: { userId: string; username: string }) {
  const online = useOnline();
  const { t } = useTranslation();
  const { data: rights } = useSuspenseQuery(rightsOptions(userId));
  const access = toAccess(rights);
  const rightsFor = useRouteRightsLookup();
  const [revision, setRevision] = useState(0);
  const refreshButton = useRef<HTMLButtonElement>(null);

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
          <RefreshButton
            onRefresh={() => setRevision((current) => current + 1)}
            buttonRef={refreshButton}
            userId={userId}
          />
          {canOpen('/administration/users', rights, rightsFor) && (
            <ActionTooltip reason={online ? undefined : t('offline.action-description')}>
              <Button
                nativeButton={!online}
                disabled={!online}
                focusableWhenDisabled={!online}
                aria-description={online ? undefined : t('offline.action-description')}
                render={
                  online ? <Link search={{ user: 'new' }} to="/administration/users" /> : undefined
                }
                size="lg"
              >
                <PlusIcon data-icon="inline-start" />
                {t('home.add-user')}
              </Button>
            </ActionTooltip>
          )}
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6">
          <DashboardRevision value={revision}>
            <HomeDashboard access={access} />
          </DashboardRevision>
          <HomeReport
            revision={revision}
            refreshButton={refreshButton}
            userId={userId}
            username={username}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

/** Reloads every number and the user's rights; cards that had failed mount again and retry. */
function RefreshButton({
  userId,
  onRefresh,
  buttonRef,
}: {
  userId: string;
  onRefresh: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const online = useOnline();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchingDashboard = useIsFetching({ queryKey: queryKeys.home.all });
  const fetchingHomeReport = useIsFetching({ queryKey: homeReportQueryKey() });
  const fetchingUser = useIsFetching({ queryKey: userRecordKey(userId), exact: true });
  const notifications = { queryKey: systemNotificationsOptions().queryKey, exact: true };
  const fetchingNotifications = useIsFetching(notifications);
  const isFetching =
    fetchingDashboard + fetchingHomeReport + fetchingUser + fetchingNotifications > 0;

  const refresh = () => {
    if (!isOnline()) return;
    void queryClient.invalidateQueries({ queryKey: rightsOptions(userId).queryKey });
    void queryClient.refetchQueries({ queryKey: userRecordKey(userId), exact: true });
    void queryClient.resetQueries({ queryKey: queryKeys.home.all });
    void queryClient.resetQueries({ queryKey: homeReportQueryKey(userId), exact: true });
    void queryClient.invalidateQueries(notifications);
    onRefresh();
  };

  return (
    <ActionTooltip reason={online ? undefined : t('offline.action-description')}>
      <Button
        ref={buttonRef}
        disabled={!online || isFetching}
        focusableWhenDisabled={!online}
        aria-description={online ? undefined : t('offline.action-description')}
        onClick={refresh}
        size="lg"
        type="button"
        variant="outline"
      >
        <RefreshCwIcon
          className={isFetching ? 'animate-spin' : undefined}
          data-icon="inline-start"
        />
        {t('home.refresh')}
      </Button>
    </ActionTooltip>
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
