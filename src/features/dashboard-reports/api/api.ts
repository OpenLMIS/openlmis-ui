import type {
  DashboardReportBody,
  ManagedDashboardReport,
} from '@/features/dashboard-reports/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

const path = '/reports/dashboardReports';
const reportPath = (id: string) => `${path}/${encodeURIComponent(id)}`;

export async function fetchDashboardReports(signal?: AbortSignal) {
  const { data } = await client.get<Page<ManagedDashboardReport>>(path, { signal });
  return data.content;
}

export async function fetchDashboardReport(id: string, signal?: AbortSignal) {
  const { data } = await client.get<ManagedDashboardReport>(reportPath(id), { signal });
  return data;
}

export async function createDashboardReport(body: DashboardReportBody) {
  const { data } = await client.post<ManagedDashboardReport>(path, body);
  return data;
}

export async function updateDashboardReport(id: string, body: DashboardReportBody) {
  const { data } = await client.put<ManagedDashboardReport>(reportPath(id), body);
  return data;
}

export async function deleteDashboardReport(id: string) {
  await client.delete(reportPath(id));
}
