import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { fetchDashboardReport, fetchDashboardReports } from '@/features/dashboard-reports/api/api';
import { queryKeys } from '@/lib/key-factory';

const dashboardReportListsKey = [...queryKeys.dashboardReports.all, 'list'] as const;

export const dashboardReportsAdminOptions = () =>
  queryOptions({
    queryKey: queryKeys.dashboardReports.list({ scope: 'admin' }),
    queryFn: ({ signal }) => fetchDashboardReports(signal),
  });

export const dashboardReportDetailOptions = (
  id: string,
  opening: number,
  reread: boolean | 'delete',
) =>
  queryOptions({
    queryKey: [...queryKeys.dashboardReports.detail(id), opening, reread],
    queryFn: ({ signal }) => fetchDashboardReport(id, signal),
  });

export async function refreshDashboardReports(client: QueryClient, isCurrent: () => boolean) {
  if (!isCurrent()) return;
  await client.cancelQueries({ queryKey: dashboardReportListsKey });
  if (!isCurrent()) return;
  void client.invalidateQueries({ queryKey: dashboardReportListsKey });
}
