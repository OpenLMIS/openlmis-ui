import { createFileRoute } from '@tanstack/react-router';
import { ChartColumnIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import {
  availableDashboardsOptions,
  reportCategoriesOptions,
  templateReportsOptions,
} from '@/features/reports/api/queries';
import { ReportCatalog, ReportCatalogSkeleton } from '@/features/reports/components/report-catalog';
import { useReloadForUser } from '@/hooks/use-reload-for-user';
import { queryKeys } from '@/lib/key-factory';
import { RIGHTS } from '@/lib/rights';
import { getReportingModules } from '@/lib/runtime-config';
import {
  assertSessionScope,
  getSessionScope,
  getSessionUserId,
  SessionEndedError,
} from '@/lib/session-scope';

export const Route = createFileRoute('/(protected)/_protected/reports')({
  loader: async ({ context: { queryClient } }) => {
    const scope = getSessionScope();
    await requireRight(queryClient, RIGHTS.reportsView);
    assertSessionScope(scope);
    const userId = getSessionUserId();
    if (!userId) throw new SessionEndedError();
    const modules = getReportingModules();
    queryClient.prefetchQuery(reportCategoriesOptions(userId));
    queryClient.prefetchQuery(availableDashboardsOptions(userId));
    for (const module of modules) queryClient.prefetchQuery(templateReportsOptions(userId, module));
    return { userId, modules };
  },
  pendingComponent: ReportsPending,
  component: ReportsPage,
});

function ReportsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ChartColumnIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('nav.reports.view')}</WorkspaceTitle>
        <WorkspaceDescription>{t('reports.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function ReportsPage() {
  const { userId, modules } = Route.useLoaderData();
  const currentUser = useReloadForUser(userId, queryKeys.reportTemplates.all);
  return (
    <Workspace>
      <ReportsHeader />
      <WorkspaceContent>
        {userId === currentUser ? (
          <ReportCatalog userId={userId} modules={modules} />
        ) : (
          <ReportCatalogSkeleton />
        )}
      </WorkspaceContent>
    </Workspace>
  );
}
function ReportsPending() {
  return (
    <Workspace>
      <ReportsHeader />
      <WorkspaceContent>
        <ReportCatalogSkeleton />
      </WorkspaceContent>
    </Workspace>
  );
}
