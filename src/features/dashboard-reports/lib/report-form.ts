import { z } from 'zod';
import type {
  DashboardReportBody,
  ManagedDashboardReport,
} from '@/features/dashboard-reports/lib/types';
import { frameableUrl } from '@/lib/frameable-url';

const reportType = z.enum(['SUPERSET', 'POWERBI'], {
  error: 'dashboard-reports.form.type-required',
});
const uuid = z.guid();
const categoryRequired = 'dashboard-reports.form.category-required';
const categoryId = z.string().trim().min(1, categoryRequired);
const fields = z.object({
  name: z.string().trim().min(1, 'dashboard-reports.form.name-required'),
  categoryId: categoryId.nullable().refine((id) => id !== null, categoryRequired),
  type: z.string().trim(),
  url: z.string().trim(),
  embeddedUuid: z.string().trim(),
  enabled: z.boolean(),
  showOnHomePage: z.boolean(),
});

type ReportForm = z.input<typeof fields>;

export const EMPTY_REPORT_FORM: ReportForm = {
  name: '',
  categoryId: null,
  type: '',
  url: '',
  embeddedUuid: '',
  enabled: false,
  showOnHomePage: false,
};

export function dashboardReportFormSchema(
  reports: readonly ManagedDashboardReport[],
  appOrigin: string,
  reportId?: string,
) {
  return fields.superRefine(({ name, type, url, embeddedUuid }, ctx) => {
    if (!reportType.safeParse(type).success) {
      ctx.addIssue({
        code: 'custom',
        path: ['type'],
        message: 'dashboard-reports.form.type-required',
      });
    } else {
      const usesUuid = type === 'SUPERSET' && Boolean(embeddedUuid);
      if (usesUuid && !uuid.safeParse(embeddedUuid).success) {
        ctx.addIssue({
          code: 'custom',
          path: ['embeddedUuid'],
          message: 'dashboard-reports.form.uuid-invalid',
        });
      }
      if (!usesUuid && (!url || !frameableUrl(url, appOrigin))) {
        ctx.addIssue({
          code: 'custom',
          path: ['url'],
          message: url
            ? 'dashboard-reports.form.url-invalid'
            : type === 'POWERBI'
              ? 'dashboard-reports.form.url-required'
              : 'dashboard-reports.form.url-or-uuid-required',
        });
      }
    }
    if (!name) return;
    if (
      reports.some(
        (report) =>
          report.id !== reportId && report.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'dashboard-reports.form.name-taken',
      });
      return;
    }
    if (reportId !== undefined) return;
    const key = name
      .toUpperCase()
      .replaceAll(' ', '_')
      .replace(/[^A-Za-z0-9_]/g, '');
    if (!/[A-Z0-9]/.test(key)) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'dashboard-reports.form.name-latin-required',
      });
    } else if (
      reports.some(({ rightName }) => rightName === `${key.replace(/^\d/, '_$&')}_RIGHT`)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'dashboard-reports.form.name-key-taken',
      });
    }
  });
}

export const REPORT_FIELD_ERRORS = {
  'report.error.dashboardReport.name.duplicated': {
    field: 'name',
    key: 'dashboard-reports.form.name-taken',
  },
  'report.error.dashboardReport.urlOrEmbeddedUuid.required': {
    field: 'url',
    key: 'dashboard-reports.form.url-or-uuid-required',
  },
  'report.error.reportCategory.notFound': {
    field: 'categoryId',
    key: 'dashboard-reports.form.category-gone',
  },
} as const;

export function toReportForm(report?: ManagedDashboardReport): ReportForm {
  if (!report) return EMPTY_REPORT_FORM;
  return {
    name: report.name,
    categoryId: report.category?.id ?? null,
    type: report.type,
    url: report.url ?? '',
    embeddedUuid: report.embeddedUuid ?? '',
    enabled: report.enabled,
    showOnHomePage: report.showOnHomePage,
  };
}

export function toReportBody(
  values: ReportForm,
  report?: ManagedDashboardReport,
): DashboardReportBody {
  const type = reportType.parse(values.type.trim());
  return {
    ...report,
    name: values.name.trim(),
    category: { id: categoryId.parse(values.categoryId) },
    type,
    url: values.url.trim() || null,
    embeddedUuid: type === 'SUPERSET' ? values.embeddedUuid.trim() || null : null,
    enabled: values.enabled,
    showOnHomePage: values.showOnHomePage,
  };
}
