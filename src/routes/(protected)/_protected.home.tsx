import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
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
import { HomeDashboard } from '@/features/home/components/home-dashboard';
import type { DashboardAccess } from '@/features/home/lib/access';

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
      </WorkspaceHeader>
      <WorkspaceContent>
        <HomeDashboard access={access} />
      </WorkspaceContent>
    </Workspace>
  );
}

/** While the rights load, the page's frame: a title and four tiles' worth of room. */
function HomePending() {
  const { t } = useTranslation();

  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('home.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('home.description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div aria-busy className="grid grid-cols-2 gap-4 @5xl/main:grid-cols-4">
          {['approve', 'convert', 'orders', 'equipment'].map((tile) => (
            <div className="h-32" key={tile}>
              <Skeleton fill />
            </div>
          ))}
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
