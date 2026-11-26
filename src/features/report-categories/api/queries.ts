import { type QueryClient, type QueryKey, queryOptions } from '@tanstack/react-query';
import { fetchReportCategories, fetchReportCategory } from '@/features/report-categories/api/api';
import type { ReportCategoriesQuery, ReportCategory } from '@/features/report-categories/lib/types';
import { queryKeys } from '@/lib/key-factory';

const reportCategoryListsKey = [...queryKeys.reportCategories.all, 'list'] as const;

export const reportCategoriesPageOptions = (query: ReportCategoriesQuery) =>
  queryOptions({
    queryKey: queryKeys.reportCategories.list(query),
    queryFn: ({ signal }) => fetchReportCategories(query, signal),
  });

const reportCategoryDetailKey = (id: string, dialog: 'edit' | 'delete') =>
  [...queryKeys.reportCategories.detail(id), dialog] as const;

export const reportCategoryDetailOptions = (
  id: string,
  dialog: 'edit' | 'delete',
  opening: number,
) =>
  queryOptions({
    queryKey: [...reportCategoryDetailKey(id, dialog), opening],
    queryFn: ({ signal }) => fetchReportCategory(id, signal),
  });

export async function refreshReportCategories(
  client: QueryClient,
  isCurrent: () => boolean,
  renamed?: ReportCategory,
) {
  const keys: QueryKey[] = [reportCategoryListsKey];
  if (renamed) keys.push(queryKeys.dashboardReports.all, queryKeys.reportTemplates.all);

  const detailKey = renamed && reportCategoryDetailKey(renamed.id, 'edit');
  const cancelKeys = detailKey ? [...keys, detailKey] : keys;
  await Promise.all(cancelKeys.map((queryKey) => client.cancelQueries({ queryKey })));
  if (!isCurrent()) return;

  for (const queryKey of keys) void client.invalidateQueries({ queryKey });
  if (detailKey) await client.refetchQueries({ queryKey: detailKey, type: 'active' });
}
