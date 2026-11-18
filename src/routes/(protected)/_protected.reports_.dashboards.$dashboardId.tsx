import { createFileRoute, type ErrorComponentProps, notFound } from '@tanstack/react-router';
import { HistoryIcon, LayoutDashboardIcon, SearchXIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { Button } from '@/components/ui/button';
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
import { dashboardLegacyHash } from '@/features/reports/lib/report-categories';
import { useBackToLegacy } from '@/hooks/use-back-to-legacy';
import { useAppName } from '@/lib/app-configuration';
import { getFlag } from '@/lib/feature-flags';
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
    if (!getFlag('NATIVE_DASHBOARDS')) return { userId, report: null };
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
  const { dashboardId } = Route.useParams();
  const { userId, report } = Route.useLoaderData();
  if (!report) return <LegacyDashboard dashboardId={dashboardId} />;
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

function LegacyDashboard({ dashboardId }: { dashboardId: string }) {
  const { t } = useTranslation();
  const appName = useAppName();
  const legacy = useBackToLegacy(dashboardLegacyHash(dashboardId));
  return (
    <Workspace width="wide">
      <DashboardHeader title={t('reports.dashboard.crumb')} />
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>{t('reports.dashboard.legacy-title')}</EmptyTitle>
            <EmptyDescription>
              {t('reports.dashboard.legacy-description', { appName })}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<a href={legacy.href} />}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                legacy.onClick();
              }}
            >
              {t('reports.dashboard.open-legacy')}
            </Button>
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}

function DashboardPending() {
  return (
    <Workspace width="wide">
      <DashboardHeader />
      <WorkspaceContent>
        <DashboardAreaSkeleton />
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
