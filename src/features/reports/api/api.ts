import type { DashboardReport, ReportCategory, TemplateReport } from '@/features/reports/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

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

export async function fetchTemplateReports(module: string, signal?: AbortSignal) {
  const { data } = await client.get<TemplateReport[]>(
    `/reports/templates/${encodeURIComponent(module)}`,
    { signal },
  );
  return data;
}
