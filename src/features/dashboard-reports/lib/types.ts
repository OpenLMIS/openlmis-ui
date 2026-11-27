import type { ReportCategory } from '@/features/reference-data/lib/types';

type DashboardReportType = 'SUPERSET' | 'POWERBI';

export type ManagedDashboardReport = {
  id: string;
  name: string;
  category?: ReportCategory | null;
  type: DashboardReportType;
  url?: string | null;
  embeddedUuid?: string | null;
  enabled: boolean;
  showOnHomePage: boolean;
  rightName?: string | null;
};

export type DashboardReportBody = Omit<ManagedDashboardReport, 'id' | 'category'> & {
  id?: string;
  category: { id: string };
};

export const REPORT_TYPE_LABELS = {
  SUPERSET: 'dashboard-reports.type.superset',
  POWERBI: 'dashboard-reports.type.powerbi',
} as const satisfies Record<DashboardReportType, string>;
