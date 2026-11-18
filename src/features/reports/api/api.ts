import {
  type ApiBase,
  lookupItems,
  type ReportLookup,
} from '@/features/reports/lib/report-lookups';
import type {
  DashboardReport,
  ReportCategory,
  ReportFormat,
  ReportTemplate,
  TemplateReport,
} from '@/features/reports/lib/types';
import { client } from '@/integrations/axios';
import { fetchReportFile } from '@/lib/fetch-report';
import type { Page } from '@/lib/types';

/** Where the shared client sends requests, so template lookups are checked against it. */
export const apiBase = (): ApiBase => ({
  baseURL: client.defaults.baseURL ?? '/api',
  origin: window.location.origin,
});

async function fetchCatalog<T>(path: string, signal?: AbortSignal, params = {}) {
  const { data } = await client.get<Page<T>>(path, { signal, params: { size: 0, ...params } });
  if (data.totalPages > 1 || data.totalElements !== data.content.length) {
    throw new Error('The report catalog response is incomplete');
  }
  return data.content;
}

export const fetchReportCategories = (signal?: AbortSignal) =>
  fetchCatalog<ReportCategory>('/reports/reportCategories', signal);

export const fetchAvailableDashboards = (signal?: AbortSignal) =>
  fetchCatalog<DashboardReport>('/reports/dashboardReports/availableReports', signal, {
    showOnHomePage: false,
  });

/** Drops the compiled template the server sends with every report, so it never reaches the cache. */
function withoutTemplateData<T extends object>(report: T): T {
  const { data: _compiled, ...rest } = report as T & { data?: unknown };
  return rest as T;
}

const templatesPath = (module: string) => `/reports/templates/${encodeURIComponent(module)}`;

export async function fetchTemplateReports(module: string, signal?: AbortSignal) {
  const { data } = await client.get<TemplateReport[]>(templatesPath(module), { signal });
  return data.map(withoutTemplateData);
}

export async function fetchTemplateReport(module: string, id: string, signal?: AbortSignal) {
  const { data } = await client.get<ReportTemplate>(
    `${templatesPath(module)}/${encodeURIComponent(id)}`,
    { signal },
  );
  return withoutTemplateData(data);
}

/** Every record a parameter's choices come from, with parent values as encoded query params. */
export async function fetchParameterOptions(
  lookup: Pick<ReportLookup, 'method' | 'path' | 'body'>,
  params: Record<string, string>,
  signal?: AbortSignal,
) {
  const config = { params, signal };
  const { data } =
    lookup.method === 'POST'
      ? await client.post<unknown>(lookup.path, lookup.body ?? {}, config)
      : await client.get<unknown>(lookup.path, config);
  return lookupItems(data);
}

export const generateReport = (
  module: string,
  id: string,
  format: ReportFormat,
  params: Record<string, string>,
  signal: AbortSignal,
) =>
  fetchReportFile(`${templatesPath(module)}/${encodeURIComponent(id)}/${format}`, params, {
    signal,
    timeout: 0,
  });

/** A Superset guest token for one embedded dashboard; callers keep it in memory only. */
export async function fetchGuestToken(embeddedUuid: string, sentFor: string, signal: AbortSignal) {
  const { data } = await client.get<{ token?: unknown }>('/reports/superset/guest-token', {
    params: { embeddedUuid },
    signal,
    sentFor,
  });
  if (typeof data?.token !== 'string' || !data.token)
    throw new Error('No guest token was returned');
  return data.token;
}
