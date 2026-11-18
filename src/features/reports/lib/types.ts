export type ReportCategory = { id: string; name: string };

type ReportSummary = {
  id: string;
  name: string;
  category?: ReportCategory | null;
};

export type CatalogReport = ReportSummary &
  ({ kind: 'template'; module: string } | { kind: 'dashboard' });

export type ReportGroup = ReportCategory & { reports: CatalogReport[] };
export type TemplateReport = ReportSummary & { description?: string | null };
export type DashboardReport = ReportSummary & {
  type?: string | null;
  url?: string | null;
  embeddedUuid?: string | null;
};

export type ReportParameterDependency = {
  id?: string | null;
  dependency?: string | null;
  placeholder?: string | null;
  property?: string | null;
};

export type ReportTemplateParameter = {
  id?: string | null;
  name: string;
  displayName?: string | null;
  defaultValue?: unknown;
  dataType?: string | null;
  selectExpression?: string | null;
  selectMethod?: string | null;
  selectBody?: string | null;
  selectProperty?: string | null;
  displayProperty?: string | null;
  description?: string | null;
  required?: boolean | null;
  displayOrder?: unknown;
  options?: readonly unknown[] | null;
  dependencies?: readonly ReportParameterDependency[] | null;
};

export type ReportTemplate = TemplateReport & {
  requiredRights?: readonly string[] | null;
  templateParameters?: readonly ReportTemplateParameter[] | null;
};

export type ReportFormat = 'pdf' | 'csv' | 'xls' | 'xlsx' | 'html';
