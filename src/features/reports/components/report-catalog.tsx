import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChartColumnIcon, TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineFailure } from '@/components/app-shell/offline-notice';
import { DataTableCard } from '@/components/data-table/data-table';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  availableDashboardsOptions,
  reportCategoriesOptions,
  templateReportsOptions,
} from '@/features/reports/api/queries';
import { dashboardLegacyHash, groupReports } from '@/features/reports/lib/report-categories';
import type { CatalogReport } from '@/features/reports/lib/types';
import { useBackToLegacy } from '@/hooks/use-back-to-legacy';
import { isRefused } from '@/lib/http';
import { reportCaughtError } from '@/lib/report-error';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

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
      aria-busy={pending && reports.length === 0}
      data-tour={TOUR_ANCHORS.reportsCatalog}
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
      {errors.map(({ id, label, query }) => (
        <CatalogError
          key={id}
          source={label}
          error={query.error}
          pending={query.isFetching}
          retry={() => void query.refetch()}
        />
      ))}
      {groups.map((group) => (
        <DataTableCard key={group.id}>
          <Table aria-label={group.name} density="comfortable" layout="fixed">
            <TableHeader surface="muted">
              <TableRow>
                <TableHead scope="col">
                  <h2
                    className="whitespace-normal wrap-anywhere"
                    data-tour={TOUR_ANCHORS.reportsCategory}
                  >
                    {group.name}
                  </h2>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.reports.map((report) => (
                <TableRow key={reportKey(report)}>
                  <TableCell>
                    <ReportLink report={report} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      ))}
      {pending && reports.length === 0 && <ReportCatalogSkeleton />}
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
  const label = <bdi className="min-w-0 wrap-anywhere">{report.name}</bdi>;
  if (report.kind === 'dashboard') return <DashboardLink report={report}>{label}</DashboardLink>;
  return (
    <Button
      data-report-key={reportKey(report)}
      data-tour={TOUR_ANCHORS.reportsLink}
      role="link"
      variant="link"
      padding="none"
      align="start"
      width="full"
      wrap="normal"
      nativeButton={false}
      render={
        <Link
          to="/reports/$module/$reportId/generate"
          params={{ module: report.module, reportId: report.id }}
        />
      }
    >
      {label}
    </Button>
  );
}

function DashboardLink({ report, children }: { report: CatalogReport; children: ReactNode }) {
  const legacy = useBackToLegacy(dashboardLegacyHash(report.id));
  return (
    <Button
      data-report-key={reportKey(report)}
      data-tour={TOUR_ANCHORS.reportsLink}
      role="link"
      variant="link"
      padding="none"
      align="start"
      width="full"
      wrap="normal"
      nativeButton={false}
      render={<a href={legacy.href} />}
      onClick={(event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        legacy.onClick();
      }}
    >
      {children}
    </Button>
  );
}

export function ReportCatalogSkeleton() {
  return (
    <div aria-hidden="true">
      <DataTableCard>
        <Table density="comfortable">
          <TableHeader surface="muted">
            <TableRow>
              <TableHead>
                <div className="h-5 w-36">
                  <Skeleton fill />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2, 3, 4, 5].map((line) => (
              <TableRow key={line}>
                <TableCell>
                  <div className="h-5 w-3/4">
                    <Skeleton fill />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
