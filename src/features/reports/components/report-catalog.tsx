import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, ChartColumnIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineFailure } from '@/components/app-shell/offline-notice';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  availableDashboardsOptions,
  reportCategoriesOptions,
  templateReportsOptions,
} from '@/features/reports/api/queries';
import { groupReports, reportLegacyHash } from '@/features/reports/lib/report-categories';
import type { CatalogReport } from '@/features/reports/lib/types';
import { useBackToLegacy } from '@/hooks/use-back-to-legacy';
import { isRefused } from '@/lib/http';
import { legacyHome } from '@/lib/legacy-home';
import { reportCaughtError } from '@/lib/report-error';

export function ReportCatalog({ userId, modules }: { userId: string; modules: readonly string[] }) {
  const { t } = useTranslation();
  const catalog = useRef<HTMLDivElement>(null);
  const focusedReport = useRef<HTMLAnchorElement | null>(null);
  useLayoutEffect(() => {
    const previous = focusedReport.current;
    if (!previous || previous.isConnected) return;
    focusedReport.current = null;
    if (document.activeElement !== document.body) return;
    const replacement = Array.from(
      catalog.current?.querySelectorAll<HTMLAnchorElement>('[data-report-key]') ?? [],
    ).find((link) => link.dataset.reportKey === previous.dataset.reportKey);
    replacement?.focus();
  });
  const categories = useQuery(reportCategoriesOptions(userId));
  const templates = useQueries({
    queries: modules.map((module) => templateReportsOptions(userId, module)),
  });
  const dashboards = useQuery(availableDashboardsOptions(userId));
  const sources = [
    { id: 'categories', label: t('reports.categories'), query: categories },
    ...templates.map((query, index) => ({
      id: `templates-${modules[index]}`,
      label:
        modules[index] === 'common'
          ? t('reports.common')
          : modules[index] === 'requisitions'
            ? t('reports.requisitions')
            : modules[index],
      query,
    })),
    { id: 'dashboards', label: t('reports.dashboards'), query: dashboards },
  ];
  const reports: CatalogReport[] = templates.flatMap((query, index) =>
    query.isError
      ? []
      : (query.data ?? []).map((report) => ({
          ...report,
          kind: 'template',
          module: modules[index],
        })),
  );
  if (!dashboards.isError) {
    reports.push(
      ...(dashboards.data ?? []).map((report) => ({ ...report, kind: 'dashboard' as const })),
    );
  }
  const groups = groupReports(
    categories.isError ? [] : (categories.data ?? []),
    reports,
    t('reports.other'),
  );
  const pending = sources.some(({ query }) => query.isPending);
  const errors = sources.filter(({ query }) => query.isError);

  return (
    <div
      ref={catalog}
      className="flex flex-col gap-4"
      aria-busy={pending}
      onFocusCapture={(event) => {
        focusedReport.current =
          event.target instanceof HTMLAnchorElement && event.target.dataset.reportKey
            ? event.target
            : null;
      }}
      onBlurCapture={() => {
        focusedReport.current = null;
      }}
    >
      <Alert variant="info" role="note">
        <InfoIcon />
        <AlertDescription id="reports-legacy-notice">
          {t('reports.legacy-description')}
        </AlertDescription>
      </Alert>
      {errors.map(({ id, label, query }) => (
        <CatalogError
          key={id}
          source={label}
          error={query.error}
          pending={query.isFetching}
          retry={() => void query.refetch()}
        />
      ))}
      <div className="grid items-start gap-4 @3xl/main:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle>
                <h2>{group.name}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1">
                {group.reports.map((report) => (
                  <li className="flex min-h-9" key={reportKey(report)}>
                    <ReportLink report={report} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      {pending && <ReportCatalogSkeleton />}
      {!pending && errors.length === 0 && reports.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChartColumnIcon />
            </EmptyMedia>
            <EmptyTitle>{t('reports.empty-title')}</EmptyTitle>
            <EmptyDescription>{t('reports.empty-description')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function CatalogError({
  source,
  error,
  pending,
  retry,
}: {
  source: string;
  error: unknown;
  pending: boolean;
  retry: () => void;
}) {
  const { t } = useTranslation();
  const offline = useOfflineFailure(error, retry);
  useEffect(() => reportCaughtError(error, {}), [error]);
  return (
    <Alert variant="destructive" actionLayout="flow">
      <TriangleAlertIcon />
      <AlertTitle>{t('reports.load-error-title', { source })}</AlertTitle>
      <AlertDescription>
        {offline
          ? t('offline.notice-description')
          : isRefused(error)
            ? t('reports.source-refused')
            : t('reports.load-error-description')}
      </AlertDescription>
      <AlertAction>
        <Button variant="outline" disabled={pending} onClick={retry}>
          {pending && <Spinner data-icon="inline-start" />}
          {t('error.try-again')}
        </Button>
      </AlertAction>
    </Alert>
  );
}

function reportKey(report: CatalogReport) {
  return `${report.kind}-${report.kind === 'template' ? report.module : ''}-${report.id}`;
}

function ReportLink({ report }: { report: CatalogReport }) {
  const hash = reportLegacyHash(report);
  const legacy = useBackToLegacy(hash);
  return (
    <Button
      data-report-key={reportKey(report)}
      role="link"
      aria-describedby="reports-legacy-notice"
      align="between"
      variant="ghost"
      width="full"
      wrap="normal"
      nativeButton={false}
      render={<a href={`${legacyHome(import.meta.env.BASE_URL)}${hash}`} />}
      onClick={(event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        legacy.onClick();
      }}
    >
      <bdi>{report.name}</bdi>
      <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" />
    </Button>
  );
}

export function ReportCatalogSkeleton() {
  return (
    <div className="grid gap-4 @3xl/main:grid-cols-2" aria-hidden="true">
      {[0, 1].map((index) => (
        <Card key={index}>
          <CardHeader>
            <div className="h-5 w-36">
              <Skeleton />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((line) => (
                <div key={line} className="h-8">
                  <Skeleton />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
