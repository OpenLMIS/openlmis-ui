import type { RequisitionLine } from '@/features/requisitions/lib/lines';
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
const adjustmentSchema = wholeNumberText(
  { invalid: 'stock-events.positive-number', tooLarge: 'stock-events.number-too-large' },
  { min: { value: 1, tooSmall: 'physical-inventory.reason-positive' } },
);
export type RequisitionValidation = {
  lines: Record<string, Record<string, string>>;
  errors: string[];
};
export type ValidationOptions = {
  monthsInPeriod: number;
  stockCountDateRequired?: boolean;
  today: string;
};
const empty = (value: unknown) => value == null || (typeof value === 'string' && !value.trim());

export function validateRequisition(
  record: Requisition & { datePhysicalStockCountCompleted?: string | null },
  lines: readonly RequisitionLine[],
  options: ValidationOptions,
): RequisitionValidation {
  const result: RequisitionValidation = { lines: {}, errors: [] };
  for (const model of lines) {
    const errors = validateLine(model, record, options.monthsInPeriod);
    if (Object.keys(errors).length) result.lines[model.line.id] = errors;
  }
  if (!lines.some((model) => !model.line.skipped))
    result.errors.push('requisitions.edit.validation.all-skipped');
  if (!record.emergency && options.stockCountDateRequired) {
    const date = record.datePhysicalStockCountCompleted;
    const parsed = date ? new Date(`${date}T00:00:00Z`) : undefined;
    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !parsed ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date ||
      date > options.today
    )
      result.errors.push('requisitions.edit.validation.stock-count-date');
  }
  return result;
}

export function validateLine(model: RequisitionLine, record: Requisition, monthsInPeriod: number) {
  const errors: Record<string, string> = {};
  const { line } = model;
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
    const value = line[name];
    const input = definition.source === 'USER_INPUT';
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
      if (!checked.success) errors[name] = checked.error.issues[0].message;
    }
    if (errors[name]) continue;
    if (
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
      const checked = adjustmentSchema.safeParse(String(adjustment.quantity));
      if (!checked.success) {
        errors.stockAdjustments = checked.error.issues[0].message;
        break;
      }
    }
  }
  return errors;
}
