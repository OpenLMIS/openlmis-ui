import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, Link, notFound } from '@tanstack/react-router';
import { FileChartColumnIcon, SearchXIcon } from 'lucide-react';
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
import { requireRouteRights } from '@/features/auth/lib/access';
import { apiBase } from '@/features/reports/api/api';
import {
  reportParameterOptionsOptions,
  reportTemplateOptions,
} from '@/features/reports/api/queries';
import { ReportParametersForm } from '@/features/reports/components/report-parameters-form';
import { classifyParameters } from '@/features/reports/lib/report-parameters';
import { isNotFound } from '@/lib/http';
import { RIGHTS } from '@/lib/rights';
import { getReportingModules } from '@/lib/runtime-config';
import {
  assertSessionScope,
  getSessionScope,
  getSessionUserId,
  SessionEndedError,
} from '@/lib/session-scope';

export const Route = createFileRoute('/(protected)/_protected/reports_/$module/$reportId/generate')(
  {
    staticData: { rights: [RIGHTS.reportsView], crumbKey: 'reports.generate.crumb' },
    loader: async ({ route, context: { queryClient }, params: { module, reportId } }) => {
      const scope = getSessionScope();
      await requireRouteRights(queryClient, route);
      assertSessionScope(scope);
      const userId = getSessionUserId();
      if (!userId) throw new SessionEndedError();
      if (!getReportingModules().includes(module)) throw notFound();
      const template = await queryClient.ensureQueryData(
        reportTemplateOptions(userId, module, reportId),
      );
      assertSessionScope(scope);
      for (const field of classifyParameters(template.templateParameters, apiBase())) {
        if (
          field.kind === 'choice' &&
          field.source.type === 'lookup' &&
          field.source.dependencies.length === 0
        )
          queryClient.prefetchQuery(reportParameterOptionsOptions(userId, field.source.lookup, {}));
      }
      return { userId };
    },
    pendingComponent: GenerateReportPending,
    errorComponent: GenerateReportError,
    notFoundComponent: ReportNotFound,
    component: GenerateReportPage,
  },
);

function GenerateReportHeader({ title }: { title?: string }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <FileChartColumnIcon />
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
        <WorkspaceDescription>{t('reports.generate.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function GenerateReportPage() {
  const { module, reportId } = Route.useParams();
  const { userId } = Route.useLoaderData();
  const { data: template } = useSuspenseQuery(reportTemplateOptions(userId, module, reportId));
  return (
    <Workspace width="form">
      <GenerateReportHeader title={template.name} />
      <WorkspaceContent>
        <ReportParametersForm
          key={`${module}/${reportId}`}
          template={template}
          module={module}
          userId={userId}
        />
      </WorkspaceContent>
    </Workspace>
  );
}

function GenerateReportPending() {
  return (
    <Workspace width="form">
      <GenerateReportHeader />
      <WorkspaceContent>
        <div aria-hidden="true" className="flex flex-col gap-6">
          {[0, 1, 2].map((line) => (
            <div key={line} className="flex flex-col gap-2">
              <div className="h-4 w-32">
                <Skeleton fill />
              </div>
              <div className="h-9">
                <Skeleton fill />
              </div>
            </div>
          ))}
          <div className="h-9 w-full @xl/main:ms-auto @xl/main:w-32">
            <Skeleton fill />
          </div>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function ReportNotFound() {
  const { t } = useTranslation();
  return (
    <Workspace width="form">
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{t('reports.generate.not-found-title')}</EmptyTitle>
            <EmptyDescription>{t('reports.generate.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link to="/reports" />} variant="outline">
              {t('reports.generate.back')}
            </Button>
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}

function GenerateReportError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  if (isNotFound(props.error)) return <ReportNotFound />;
  return (
    <ErrorFallback
      {...props}
      title={t('reports.generate.load-error-title')}
      description={t('reports.generate.load-error-description')}
    />
  );
}
