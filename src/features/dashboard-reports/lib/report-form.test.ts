import { expect, it } from 'vitest';
import {
  dashboardReportFormSchema,
  EMPTY_REPORT_FORM,
  toReportBody,
} from '@/features/dashboard-reports/lib/report-form';
import type { ManagedDashboardReport } from '@/features/dashboard-reports/lib/types';

const origin = 'https://openlmis.example.org';
const uuid = '42ef1032-a83a-40e9-9b67-a2c2569c2b66';
const values = {
  ...EMPTY_REPORT_FORM,
  name: 'Stock',
  categoryId: 'category',
  type: 'SUPERSET',
  url: 'https://bi.example.org',
};
const existing: ManagedDashboardReport = {
  id: uuid,
  name: 'Renamed',
  category: { id: 'category', name: 'Category' },
  type: 'SUPERSET',
  url: values.url,
  enabled: true,
  showOnHomePage: false,
  rightName: '_9_STOCK_RIGHT',
};

it.each([
  [{ name: '   ' }, 'form.name-required'],
  [{ categoryId: '   ' }, 'form.category-required'],
  [{ type: '   ' }, 'form.type-required'],
  [{ url: ' ' }, 'form.url-or-uuid-required'],
  [{ type: 'POWERBI', url: ' ', embeddedUuid: uuid }, 'form.url-required'],
  [{ embeddedUuid: 'malformed' }, 'form.uuid-invalid'],
  [{ url: origin }, 'form.url-invalid'],
  [{ url: 'https://user:password@bi.example.org' }, 'form.url-invalid'],
  [{ name: 'المخزون' }, 'form.name-latin-required'],
  [{ name: '9 Stock!' }, 'form.name-key-taken'],
])('validates %j', (patch, issue) => {
  const result = dashboardReportFormSchema([existing], origin).safeParse({ ...values, ...patch });
  expect(result.error?.issues.map(({ message }) => message)).toContain(
    `dashboard-reports.${issue}`,
  );
});

it('preserves an unused Superset URL when a valid UUID is present', () => {
  const input = { ...values, url: 'old value', embeddedUuid: uuid };
  expect(dashboardReportFormSchema([], origin).safeParse(input).success).toBe(true);
  expect(toReportBody(input)).toMatchObject({ url: 'old value', embeddedUuid: uuid });
});

it('checks Edit names against other reports and keeps the original right', () => {
  const name = ' rEnAmEd ';
  expect(
    dashboardReportFormSchema([existing], origin, 'other').safeParse({ ...values, name }).error
      ?.issues[0].message,
  ).toBe('dashboard-reports.form.name-taken');
  const editSchema = dashboardReportFormSchema([existing], origin, existing.id);
  expect(editSchema.safeParse({ ...values, name }).success).toBe(true);
  expect(editSchema.safeParse({ ...values, name: 'المخزون' }).success).toBe(true);
  expect(editSchema.safeParse({ ...values, name: '9 Stock!' }).success).toBe(true);
  expect(toReportBody(values, existing)).toMatchObject({
    id: existing.id,
    rightName: existing.rightName,
  });
});

it('trims fields and clears the UUID on Power BI saves', () => {
  expect(
    toReportBody({
      ...values,
      name: ' Stock ',
      categoryId: ' category ',
      type: ' POWERBI ',
      url: ' https://bi.example.org ',
      embeddedUuid: uuid,
    }),
  ).toEqual({
    name: 'Stock',
    category: { id: 'category' },
    type: 'POWERBI',
    url: 'https://bi.example.org',
    embeddedUuid: null,
    enabled: false,
    showOnHomePage: false,
  });
});
