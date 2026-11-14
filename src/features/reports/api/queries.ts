import { queryOptions } from '@tanstack/react-query';
import {
  fetchAvailableDashboards,
  fetchReportCategories,
  fetchTemplateReports,
} from '@/features/reports/api/api';
import { queryKeys } from '@/lib/key-factory';

export const reportCategoriesOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.reportCategories.list({ userId }),
    queryFn: ({ signal }) => fetchReportCategories(signal),
  });

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
