import type { ParseKeys } from 'i18next';
import { adjustmentQuantitySchema } from '@/features/requisitions/lib/adjustments';
import { calculateLine } from '@/features/requisitions/lib/calculations';
import type { LineDraft } from '@/features/requisitions/lib/draft';
import type { RequisitionLine } from '@/features/requisitions/lib/lines';
import type { PatientsData } from '@/features/requisitions/lib/patients';
import type { Requisition, RequisitionLineItem } from '@/features/requisitions/lib/requisition';
import { compileColumns } from '@/features/requisitions/lib/template';
import { wholeNumberText } from '@/lib/whole-number';

const optional = new Set([
  'skipped',
  'remarks',
  'totalLossesAndAdjustments',
  'requestedQuantityExplanation',
  'requestedQuantity',
  'adjustedConsumption',
  'numberOfNewPatientsAdded',
]);
const numberSchema = wholeNumberText(
  {
    required: 'stock-events.required',
    invalid: 'stock-events.positive-number',
    tooLarge: 'stock-events.number-too-large',
  },
  { optional: true },
);
type RequisitionValidation = {
  lines: Record<string, Record<string, ParseKeys>>;
  errors: ParseKeys[];
};
type ValidationOptions = {
  monthsInPeriod: number;
  columns?: readonly string[];
};
const empty = (value: unknown) => value == null || (typeof value === 'string' && !value.trim());

export function validateRequisition(
  record: Requisition,
  lines: readonly RequisitionLine[],
  options: ValidationOptions,
  changes: Record<string, LineDraft> = {},
): RequisitionValidation {
  const result: RequisitionValidation = { lines: {}, errors: [] };
  for (const model of lines) {
    const errors = validateLine(
      model,
      record,
      options.monthsInPeriod,
      changes[model.line.id],
      options.columns,
    );
    if (Object.keys(errors).length) result.lines[model.line.id] = errors;
  }
  if (!lines.some((model) => !model.line.skipped))
    result.errors.push('requisitions.edit.validation.all-skipped');
  return result;
}

export function validateLine(
  model: RequisitionLine,
  record: Requisition,
  monthsInPeriod: number,
  changes: LineDraft = {},
  columnFilter?: readonly string[],
  patients?: PatientsData,
) {
  const errors: Record<string, ParseKeys> = {};
  const line = calculateLine(model, record, monthsInPeriod, patients);
  if (line.skipped) return errors;
  const columns = compileColumns(record.template, {
    status: record.status,
    emergency: record.emergency,
    tab: model.fullSupply ? 'fullSupply' : 'nonFullSupply',
  });
  const shown = new Set(columns.map((column) => column.name));
  const hasCalculated =
    shown.has('calculatedOrderQuantity') || shown.has('calculatedOrderQuantityIsa');
  const stock =
    (line.beginningBalance ?? 0) +
    (line.totalReceivedQuantity ?? 0) +
    (line.totalLossesAndAdjustments ?? 0);
  for (const column of columns) {
    const name = column.name as keyof RequisitionLineItem;
    const definition = record.template.columnsMap[name];
    if (!definition || name === 'skipped' || name === 'totalLossesAndAdjustments') continue;
    if (
      record.template.patientsTabEnabled &&
      (name === 'totalReceivedQuantity' ||
        name === 'remarks' ||
        (name === 'numberOfPatientsOnTreatmentNextMonth' &&
          ['INITIATED', 'REJECTED', 'SUBMITTED'].includes(record.status)) ||
        (name === 'stockOnHand' && record.status === 'AUTHORIZED'))
    )
      continue;
    const value =
      name === 'numberOfPatientsOnTreatmentNextMonth' && Object.hasOwn(changes, name)
        ? changes[name]
        : line[name];
    const input =
      definition.source === 'USER_INPUT' ||
      (record.template.patientsTabEnabled && name === 'numberOfPatientsOnTreatmentNextMonth');
    const required =
      input &&
      (!optional.has(name) ||
        (name === 'requestedQuantity' &&
          (!model.fullSupply || record.emergency || !hasCalculated)));
    if (required && empty(value)) errors[name] = 'stock-events.required';
    else if ((name === 'stockOnHand' || name === 'totalConsumedQuantity') && Number(value) < 0)
      errors[name] = 'requisitions.edit.validation.negative';
    else if (
      !empty(value) &&
      (column.kind === 'quantity' || column.kind === 'count') &&
      definition.columnDefinition?.columnType !== 'BOOLEAN'
    ) {
      const checked = numberSchema.safeParse(String(value));
      if (!checked.success) errors[name] = checked.error.issues[0].message as ParseKeys;
    }
    if (errors[name]) continue;
    if (
      !record.template.patientsTabEnabled &&
      !record.emergency &&
      model.fullSupply &&
      !record.template.populateStockOnHandFromStockCards &&
      record.template.columnsMap.stockOnHand?.source === 'USER_INPUT' &&
      record.template.columnsMap.totalConsumedQuantity?.source === 'USER_INPUT' &&
      (name === 'stockOnHand' || name === 'totalConsumedQuantity') &&
      !empty(value) &&
      (line.stockOnHand ?? 0) + (line.totalConsumedQuantity ?? 0) !== stock
    )
      errors[name] = 'requisitions.edit.validation.balance';
    if (name === 'totalStockoutDays' && Number(value) > 30 * monthsInPeriod)
      errors[name] = 'requisitions.edit.validation.stockout-days';
    if (name === 'remarks' && typeof value === 'string' && value.length > 250)
      errors[name] = 'requisitions.edit.validation.remarks-length';
    if (name === 'requestedQuantityExplanation') {
      const calculated = shown.has('calculatedOrderQuantity')
        ? line.calculatedOrderQuantity
        : line.calculatedOrderQuantityIsa;
      if (
        model.fullSupply &&
        shown.has('requestedQuantity') &&
        hasCalculated &&
        !empty(line.requestedQuantity) &&
        line.requestedQuantity !== calculated &&
        !value
      )
        errors[name] = 'stock-events.required';
      else if (typeof value === 'string' && value.length > 255)
        errors[name] = 'requisitions.edit.validation.explanation-length';
    }
  }
  if (model.fullSupply && !record.emergency && !record.template.populateStockOnHandFromStockCards) {
    for (const adjustment of line.stockAdjustments ?? []) {
      const checked = adjustmentQuantitySchema.safeParse(String(adjustment.quantity));
      if (!checked.success) {
        errors.stockAdjustments = checked.error.issues[0].message as ParseKeys;
        break;
      }
    }
  }
  for (const column of columns) {
    const value = changes[column.name as keyof LineDraft];
    if (
      typeof value !== 'string' ||
      (record.template.columnsMap[column.name]?.source !== 'USER_INPUT' &&
        !(
          record.template.patientsTabEnabled &&
          column.name === 'numberOfPatientsOnTreatmentNextMonth'
        )) ||
      !['quantity', 'count'].includes(column.kind)
    )
      continue;
    const checked = numberSchema.safeParse(value);
    if (!checked.success && errors[column.name] !== 'requisitions.edit.validation.negative')
      errors[column.name] = checked.error.issues[0].message as ParseKeys;
  }
  return columnFilter
    ? Object.fromEntries(Object.entries(errors).filter(([name]) => columnFilter.includes(name)))
    : errors;
}
