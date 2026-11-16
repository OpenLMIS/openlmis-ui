import { z } from 'zod';
import {
  type ApiBase,
  type ReportChoice,
  type ReportLookup,
  staticChoices,
  toLookup,
} from '@/features/reports/lib/report-lookups';
import type { ReportFormat, ReportTemplateParameter } from '@/features/reports/lib/types';
import { toLatinDigits, wholeNumberText } from '@/lib/whole-number';

export const REPORT_FORMATS = [
  'pdf',
  'csv',
  'xls',
  'xlsx',
  'html',
] as const satisfies readonly ReportFormat[];

export type ReportDependency = { parentKey: string; placeholder: string };

export type ReportChoiceSource =
  | { type: 'static'; options: ReportChoice[] }
  | { type: 'lookup'; lookup: ReportLookup; dependencies: ReportDependency[] }
  | { type: 'unsupported' };

/** Legacy's two hints, given by exact parameter name. */
export type ReportHelp = 'geographic-zone' | 'due-days';

type FieldBase = {
  /** The form field's name, unique and safe as an element id. */
  key: string;
  /** The parameter's exact name, as the server matches it. */
  name: string;
  label: string;
  required: boolean;
  help?: ReportHelp;
};

export type ReportField = FieldBase &
  (
    | { kind: 'date' | 'boolean' | 'whole-number' | 'text' }
    | { kind: 'choice'; source: ReportChoiceSource }
  );

export type ReportFormValues = Record<string, string | null>;

const HELP: Record<string, ReportHelp> = {
  GeographicZone: 'geographic-zone',
  DueDays: 'due-days',
};

function choiceSource(
  parameter: ReportTemplateParameter,
  keys: ReadonlyMap<string, string>,
  api: ApiBase,
): ReportChoiceSource {
  const dependencies = parameter.dependencies ?? [];
  if (dependencies.length > 0 || parameter.selectExpression) {
    const lookup = toLookup(parameter, api);
    const parents = dependencies.map(({ dependency, placeholder }) => {
      const parentKey = dependency && dependency !== parameter.name && keys.get(dependency);
      return parentKey && placeholder ? { parentKey, placeholder } : undefined;
    });
    if (!lookup || parents.some((parent) => !parent)) return { type: 'unsupported' };
    return { type: 'lookup', lookup, dependencies: parents as ReportDependency[] };
  }
  return { type: 'static', options: staticChoices(parameter.options ?? []) };
}

/** The form's fields in the template's order, chosen as legacy chooses its controls. */
export function classifyParameters(
  parameters: readonly ReportTemplateParameter[] | null | undefined,
  api: ApiBase,
): ReportField[] {
  const list = parameters ?? [];
  const keys = new Map<string, string>();
  list.forEach((parameter, index) => {
    if (!keys.has(parameter.name)) keys.set(parameter.name, `report-parameter-${index}`);
  });
  return list.map((parameter, index) => {
    const base: FieldBase = {
      key: `report-parameter-${index}`,
      name: parameter.name,
      label: parameter.displayName ?? parameter.name,
      required: parameter.required === true,
      ...(HELP[parameter.name] ? { help: HELP[parameter.name] } : {}),
    };
    const hasOptions = (parameter.options?.length ?? 0) > 0;
    if (parameter.description === 'datepickers') return { ...base, kind: 'date' };
    if (parameter.description === 'booleanSelect' && !hasOptions)
      return { ...base, kind: 'boolean' };
    if ((parameter.dependencies?.length ?? 0) > 0 || parameter.selectExpression || hasOptions)
      return { ...base, kind: 'choice', source: choiceSource(parameter, keys, api) };
    if (parameter.dataType === 'java.lang.Integer') return { ...base, kind: 'whole-number' };
    return { ...base, kind: 'text' };
  });
}

export const emptyReportValues = (fields: readonly ReportField[]): ReportFormValues => ({
  format: 'pdf',
  ...Object.fromEntries(fields.map((field) => [field.key, field.kind === 'choice' ? null : ''])),
});

const REQUIRED = 'reports.generate.required';

function fieldSchema(field: ReportField) {
  if (field.kind === 'whole-number')
    return wholeNumberText(
      {
        required: REQUIRED,
        invalid: 'reports.generate.whole-number',
        tooLarge: 'reports.generate.too-large',
      },
      {
        min: { value: 0, tooSmall: 'reports.generate.whole-number' },
        optional: !field.required,
      },
    );
  const value = z.string().nullable();
  return field.required ? value.refine((text) => Boolean(text), REQUIRED) : value;
}

export function reportParametersSchema(fields: readonly ReportField[]) {
  return z.object({
    format: z.enum(REPORT_FORMATS, { message: REQUIRED }),
    ...Object.fromEntries(fields.map((field) => [field.key, fieldSchema(field)])),
  });
}

/** Exact-case names with set values only; `false` and `0` are values. */
export function serializeReportParams(
  fields: readonly ReportField[],
  values: ReportFormValues,
  language: string,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (value === null || value === undefined) continue;
    const sent = field.kind === 'whole-number' ? toLatinDigits(value.trim()) : value;
    if (sent !== '') params[field.name] = sent;
  }
  if (!fields.some((field) => field.name === 'lang')) params.lang = language;
  return params;
}
