import { describe, expect, it } from 'vitest';
import {
  classifyParameters,
  type ReportField,
  reportParametersSchema,
  serializeReportParams,
} from '@/features/reports/lib/report-parameters';
import {
  FACILITY_ASSIGNMENT,
  PERIODIC_SUMMARY,
  REPORTING_RATE,
  reportParameter,
  SAMPLE_REQUISITION,
  STOCK_ON_HAND,
  TIMELINESS,
} from '@/test-utils/report-templates';

const API = { baseURL: '/api', origin: 'https://lmis.example' };
const summary = (fields: ReportField[]) =>
  fields.map((field) => [
    field.name,
    field.label,
    field.required,
    field.kind === 'choice' ? `choice:${field.source.type}` : field.kind,
  ]);

describe('classifyParameters', () => {
  it('builds the six live forms in returned order with their labels and required marks', () => {
    expect(summary(classifyParameters(STOCK_ON_HAND.templateParameters, API))).toEqual([
      ['date', 'Date', true, 'date'],
      ['facility', 'Facility', false, 'choice:lookup'],
      ['expiredProducts', 'Expired Products', false, 'boolean'],
      ['facilityType', 'Facility Type', false, 'choice:lookup'],
      ['geographicZone', 'Geographic Zone', false, 'choice:lookup'],
      ['program', 'Program', false, 'choice:lookup'],
      ['product', 'Product', false, 'choice:lookup'],
    ]);
    expect(classifyParameters(FACILITY_ASSIGNMENT.templateParameters, API)).toEqual([]);
    expect(summary(classifyParameters(PERIODIC_SUMMARY.templateParameters, API))).toEqual([
      ['startDate', 'Start Date', true, 'date'],
      ['endDate', 'End Date', true, 'date'],
      ['facility', 'Facility', true, 'choice:lookup'],
      ['program', 'Program', true, 'choice:lookup'],
      ['product', 'Product', false, 'choice:lookup'],
    ]);
    expect(summary(classifyParameters(SAMPLE_REQUISITION.templateParameters, API))).toEqual([
      ['Program', 'Program Name', true, 'choice:lookup'],
    ]);
    expect(summary(classifyParameters(REPORTING_RATE.templateParameters, API))).toEqual([
      ['GeographicZone', 'Geographic Zone', false, 'choice:lookup'],
      ['Program', 'Program', true, 'choice:lookup'],
      ['Period', 'Processing Period', true, 'choice:lookup'],
      ['DueDays', 'Due date (days)', false, 'whole-number'],
    ]);
  });

  it('makes Timeliness Period depend on Program, and keeps Reporting Rate Period independent', () => {
    const [, program, period] = classifyParameters(TIMELINESS.templateParameters, API);
    expect(period?.kind === 'choice' && period.source).toMatchObject({
      type: 'lookup',
      lookup: { method: 'GET', path: '/processingPeriods' },
      dependencies: [{ parentKey: program?.key, placeholder: 'programId' }],
    });
    const rate = classifyParameters(REPORTING_RATE.templateParameters, API)[2];
    expect(rate?.kind === 'choice' && rate.source).toMatchObject({ dependencies: [] });
  });

  it('adds the two legacy hints by exact parameter name only', () => {
    const help = (fields: ReportField[]) => fields.map((field) => field.help ?? null);
    expect(help(classifyParameters(REPORTING_RATE.templateParameters, API))).toEqual([
      'geographic-zone',
      null,
      null,
      'due-days',
    ]);
    expect(help(classifyParameters(STOCK_ON_HAND.templateParameters, API))).toEqual(
      Array(7).fill(null),
    );
  });

  it('follows the legacy decision order for source-only shapes', () => {
    const [date, booleanChoice, staticChoice, whole, text, unsafe, unknownParent] =
      classifyParameters(
        [
          reportParameter({
            name: 'synthetic-date',
            description: 'datepickers',
            selectExpression: '/api/programs',
            selectProperty: 'id',
          }),
          reportParameter({
            name: 'synthetic-yes',
            description: 'booleanSelect',
            options: ['Y', 'N'],
          }),
          reportParameter({
            name: 'synthetic-static',
            options: ['Monthly', '', 'Monthly', 'Weekly'],
          }),
          reportParameter({ name: 'synthetic-count', dataType: 'java.lang.Integer' }),
          reportParameter({ name: 'synthetic-text' }),
          reportParameter({
            name: 'synthetic-unsafe',
            selectExpression: '/api//reports.invalid/x',
            selectProperty: 'id',
          }),
          reportParameter({
            name: 'synthetic-orphan',
            selectExpression: '/api/processingPeriods',
            selectProperty: 'id',
            dependencies: [{ dependency: 'missing', placeholder: 'programId' }],
          }),
        ],
        API,
      );
    expect(date?.kind).toBe('date');
    expect(booleanChoice?.kind === 'choice' && booleanChoice.source).toEqual({
      type: 'static',
      options: [
        { value: 'Y', label: 'Y' },
        { value: 'N', label: 'N' },
      ],
    });
    expect(staticChoice?.kind === 'choice' && staticChoice.source).toEqual({
      type: 'static',
      options: [
        { value: 'Monthly', label: 'Monthly' },
        { value: 'Weekly', label: 'Weekly' },
      ],
    });
    expect(whole?.kind).toBe('whole-number');
    expect(text?.kind).toBe('text');
    expect(unsafe?.kind === 'choice' && unsafe.source.type).toBe('unsupported');
    expect(unknownParent?.kind === 'choice' && unknownParent.source.type).toBe('unsupported');
  });
});

describe('reportParametersSchema and serializeReportParams', () => {
  const rate = classifyParameters(REPORTING_RATE.templateParameters, API);
  const keys = Object.fromEntries(rate.map((field) => [field.name, field.key]));
  const values = (entries: Record<string, string | null>) => ({
    format: 'pdf',
    ...Object.fromEntries(rate.map((field) => [field.key, field.kind === 'choice' ? null : ''])),
    ...Object.fromEntries(Object.entries(entries).map(([name, value]) => [keys[name], value])),
  });
  const errors = (fields: ReportField[], input: Record<string, unknown>) => {
    const result = reportParametersSchema(fields).safeParse(input);
    return result.success
      ? {}
      : Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
  };

  it('requires required fields and Format, and nothing else', () => {
    expect(errors(rate, values({}))).toEqual({
      [keys.Program as string]: 'reports.generate.required',
      [keys.Period as string]: 'reports.generate.required',
    });
    expect(errors(rate, { ...values({ Program: 'p1', Period: 'q1' }), format: '' })).toHaveProperty(
      'format',
    );
    expect(errors(rate, values({ Program: 'p1', Period: 'q1' }))).toEqual({});
  });

  it.each(['-1', '1.5', 'abc', '2147483648'])('refuses %s due days', (dueDays) => {
    expect(errors(rate, values({ Program: 'p1', Period: 'q1', DueDays: dueDays }))).toHaveProperty(
      keys.DueDays as string,
    );
  });

  it('sends exact names, set values only, digits in Latin and the page language', () => {
    expect(
      serializeReportParams(rate, values({ Program: 'p1', Period: 'q1', DueDays: '١٥' }), 'ar'),
    ).toEqual({ Program: 'p1', Period: 'q1', DueDays: '15', lang: 'ar' });
    expect(
      serializeReportParams(rate, values({ Program: 'p1', Period: 'q1', DueDays: '' }), 'en'),
    ).toEqual({ Program: 'p1', Period: 'q1', lang: 'en' });
  });

  it('keeps false and zero, sends dates unchanged and lets a template lang win', () => {
    const fields = classifyParameters(
      [
        ...(STOCK_ON_HAND.templateParameters ?? []).slice(0, 3),
        reportParameter({ name: 'count', dataType: 'java.lang.Integer' }),
        reportParameter({ name: 'lang' }),
      ],
      API,
    );
    const [date, facility, expired, count, lang] = fields.map((field) => field.key);
    expect(
      serializeReportParams(
        fields,
        {
          format: 'csv',
          [date as string]: '2026-11-01',
          [facility as string]: null,
          [expired as string]: 'false',
          [count as string]: '0',
          [lang as string]: 'fr',
        },
        'en',
      ),
    ).toEqual({ date: '2026-11-01', expiredProducts: 'false', count: '0', lang: 'fr' });
  });
});
