import { createFileRoute, type ErrorComponentProps, notFound } from '@tanstack/react-router';
import { LayoutDashboardIcon, SearchXIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { availableDashboardsOptions } from '@/features/reports/api/queries';
import {
  BackToReports,
  DashboardAreaSkeleton,
} from '@/features/reports/components/dashboard-states';
import { DashboardViewer } from '@/features/reports/components/dashboard-viewer';
import { RIGHTS } from '@/lib/rights';
import { getSupersetUrl } from '@/lib/runtime-config';
import {
  assertSessionScope,
  getSessionScope,
  getSessionUserId,
  SessionEndedError,
} from '@/lib/session-scope';

export const Route = createFileRoute('/(protected)/_protected/reports_/dashboards/$dashboardId')({
  staticData: { crumbKey: 'reports.dashboard.crumb' },
  loader: async ({ context: { queryClient }, params: { dashboardId } }) => {
    const scope = getSessionScope();
    await requireRight(queryClient, RIGHTS.reportsView);
    assertSessionScope(scope);
    const userId = getSessionUserId();
    if (!userId) throw new SessionEndedError();
    const dashboards = await queryClient.ensureQueryData(availableDashboardsOptions(userId));
    assertSessionScope(scope);
    const report = dashboards.find(({ id }) => id === dashboardId);
    if (!report) throw notFound();
    return { userId, report };
  },
  pendingComponent: DashboardPending,
  errorComponent: DashboardError,
  notFoundComponent: DashboardNotAvailable,
  component: DashboardPage,
});

function DashboardHeader({ title }: { title?: string }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <LayoutDashboardIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>
          {title === undefined ? (
            <span className="block h-5 w-56 max-w-full">
              <Skeleton fill inline />
            </span>
          ) : (
            <bdi>{title}</bdi>
          )}
        </WorkspaceTitle>
        <WorkspaceDescription>{t('reports.dashboard.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function DashboardPage() {
  const { t } = useTranslation();
  const { userId, report } = Route.useLoaderData();
  return (
    <Workspace width="wide">
      <DashboardHeader title={report.name || t('reports.dashboard.crumb')} />
      <WorkspaceContent>
        <DashboardViewer
          key={report.id}
          report={report}
          supersetUrl={getSupersetUrl()}
          userId={userId}
        />
      </WorkspaceContent>
    </Workspace>
  );
}

function DashboardPending() {
  return (
    <Workspace width="wide">
      <DashboardHeader />
      <WorkspaceContent>
        <div className="h-svh min-h-120">
          <DashboardAreaSkeleton />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function DashboardNotAvailable() {
  const { t } = useTranslation();
  return (
    <Workspace width="wide">
      <DashboardHeader title={t('reports.dashboard.crumb')} />
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{t('reports.dashboard.not-available-title')}</EmptyTitle>
            <EmptyDescription>{t('reports.dashboard.not-available-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <BackToReports />
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}

function DashboardError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ErrorFallback
      {...props}
      title={t('reports.dashboard.load-error-title')}
      description={t('reports.dashboard.load-error-description')}
    />
  );
}
