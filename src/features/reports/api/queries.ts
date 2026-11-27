import { queryOptions } from '@tanstack/react-query';
import {
  fetchAvailableDashboards,
  fetchParameterOptions,
  fetchTemplateReport,
  fetchTemplateReports,
} from '@/features/reports/api/api';
import type { ReportLookup } from '@/features/reports/lib/report-lookups';
import { queryKeys } from '@/lib/key-factory';

export const availableDashboardsOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.dashboardReports.list({ userId, showOnHomePage: false }),
    queryFn: ({ signal }) => fetchAvailableDashboards(signal),
  });

export const templateReportsOptions = (userId: string, module: string) =>
  queryOptions({
    queryKey: queryKeys.reportTemplates.list({ userId, module }),
    queryFn: ({ signal }) => fetchTemplateReports(module, signal),
  });

export const reportTemplateOptions = (userId: string, module: string, id: string) =>
  queryOptions({
    queryKey: [...queryKeys.reportTemplates.all, 'detail', { userId, module, id }] as const,
    queryFn: ({ signal }) => fetchTemplateReport(module, id, signal),
  });

/** The records behind a parameter's choices; reports asking for the same read share one entry. */
export const reportParameterOptionsOptions = (
  userId: string,
  { method, path, body }: Pick<ReportLookup, 'method' | 'path' | 'body'>,
  params: Record<string, string>,
) =>
  queryOptions({
    queryKey: queryKeys.reportParameterOptions.list({ userId, method, path, body, params }),
    queryFn: ({ signal }) => fetchParameterOptions({ method, path, body }, params, signal),
    staleTime: 10 * 60_000,
  });
