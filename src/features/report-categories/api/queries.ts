import { type QueryClient, type QueryKey, queryOptions } from '@tanstack/react-query';
import { fetchReportCategories, fetchReportCategory } from '@/features/report-categories/api/api';
import type { ReportCategoriesQuery } from '@/features/report-categories/lib/types';
import { queryKeys } from '@/lib/key-factory';

const reportCategoryListsKey = [...queryKeys.reportCategories.all, 'list'] as const;

export const reportCategoriesPageOptions = (query: ReportCategoriesQuery) =>
  queryOptions({
    queryKey: queryKeys.reportCategories.list(query),
    queryFn: ({ signal }) => fetchReportCategories(query, signal),
  });

export const reportCategoryDetailOptions = (id: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.reportCategories.detail(id), opening],
    queryFn: ({ signal }) => fetchReportCategory(id, signal),
  });

export async function refreshReportCategories(
  client: QueryClient,
  isCurrent: () => boolean,
  renamed = false,
) {
  const keys: QueryKey[] = [reportCategoryListsKey];
  if (renamed) keys.push(queryKeys.dashboardReports.all, queryKeys.reportTemplates.all);

  await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey })));
  if (!isCurrent()) return;

  for (const queryKey of keys) void client.invalidateQueries({ queryKey });
}
