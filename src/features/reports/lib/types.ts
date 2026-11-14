export type ReportCategory = { id: string; name: string };

type ReportSummary = {
  id: string;
  name: string;
  category?: ReportCategory | null;
};

export type CatalogReport = ReportSummary &
  ({ kind: 'template'; module: string } | { kind: 'dashboard' });

export type ReportGroup = ReportCategory & { reports: CatalogReport[] };
export type TemplateReport = ReportSummary & { description?: string };
export type DashboardReport = ReportSummary;
