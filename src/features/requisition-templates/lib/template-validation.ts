import type { ParseKeys } from 'i18next';
import {
  type ColumnDraft,
  columnOrder,
  type TemplateDraft,
} from '@/features/requisition-templates/lib/template-draft';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

export type TemplateError = {
  key: ParseKeys;
  values?: Record<string, string>;
};
export type RowError = TemplateError & {
  field:
    | 'label'
    | 'definition'
    | 'source'
    | 'optionId'
    | 'isDisplayed'
    | 'numberOfPeriodsToAverage'
    | 'tag';
};

const UTF8_REGEX =
  /^(?:[!-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])(?:[ -\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])+$/;
const PREFIX = 'requisition-templates.configure.validation.';
const periodsSchema = wholeNumberText({
  required: `${PREFIX}periods-required`,
  invalid: `${PREFIX}periods-whole`,
  tooLarge: `${PREFIX}periods-too-large`,
});

const DEPENDENCIES: Record<string, readonly string[]> = {
  stockOnHand: [
    'beginningBalance',
    'totalReceivedQuantity',
    'totalConsumedQuantity',
    'totalLossesAndAdjustments',
  ],
  totalConsumedQuantity: [
    'beginningBalance',
    'totalReceivedQuantity',
    'stockOnHand',
    'totalLossesAndAdjustments',
  ],
  total: ['beginningBalance', 'totalReceivedQuantity'],
  convertedQuantityToIssue: ['beginningBalance', 'quantityToIssue'],
  packsToShip: ['requestedQuantity', 'approvedQuantity', 'calculatedOrderQuantity'],
  totalCost: ['packsToShip', 'pricePerPack'],
  adjustedConsumption: ['totalConsumedQuantity', 'additionalQuantityRequired', 'totalStockoutDays'],
  averageConsumption: ['totalConsumedQuantity', 'totalStockoutDays'],
  requestedQuantityExplanation: ['requestedQuantity'],
  maximumStockQuantity: ['averageConsumption'],
  calculatedOrderQuantity: ['maximumStockQuantity', 'stockOnHand'],
  quantityToIssue: ['stockOnHand', 'numberOfPatientsOnTreatmentNextMonth'],
  totalRequirement: ['stockOnHand', 'numberOfPatientsOnTreatmentNextMonth'],
  totalQuantityNeededByHf: ['stockOnHand', 'numberOfPatientsOnTreatmentNextMonth'],
};

type NamedColumns = Record<string, ColumnDraft>;

function circularDependencies(name: string, columns: NamedColumns) {
  const visited = new Set<string>();
  const found: string[] = [];
  function check(current: string | null, parent: string | null) {
    if (current && visited.has(current)) return;
    if (current === name) {
      if (parent) found.push(parent);
      return;
    }
    if (current) visited.add(current);
    const next = current ?? name;
    if (!columns[next]) return;
    for (const dependency of DEPENDENCIES[next] ?? []) {
      if (columns[dependency]?.source === 'CALCULATED') check(dependency, next);
    }
  }
  check(null, null);
  return found;
}

const empty = (value: string | null | undefined) => !value?.trim();

function columnRule(
  name: string,
  column: ColumnDraft,
  draft: TemplateDraft,
  columns: NamedColumns,
): RowError | undefined {
  if (name === 'averageConsumption') {
    const result = periodsSchema.safeParse(draft.numberOfPeriodsToAverage);
    if (!result.success)
      return {
        field: 'numberOfPeriodsToAverage',
        key: result.error.issues[0].message as ParseKeys,
      };
    const periods = toWholeNumber(draft.numberOfPeriodsToAverage);
    if (!periods) return { field: 'numberOfPeriodsToAverage', key: `${PREFIX}periods-required` };
    if (periods < 2) return { field: 'numberOfPeriodsToAverage', key: `${PREFIX}periods-minimum` };
  }
  const paired: Record<string, string> = {
    requestedQuantity: 'requestedQuantityExplanation',
    requestedQuantityExplanation: 'requestedQuantity',
    additionalQuantityRequired: 'adjustedConsumption',
  };
  const other = columns[paired[name]];
  if (column.isDisplayed && other && !other.isDisplayed) {
    return {
      field: 'isDisplayed',
      key: `${PREFIX}display-mismatch`,
      values: { column: other.label },
    };
  }
  if (name === 'totalStockoutDays' && !draft.patientsTabEnabled && !column.isDisplayed) {
    for (const dependency of ['adjustedConsumption', 'averageConsumption']) {
      const other = columns[dependency];
      if (other?.isDisplayed && other.source === 'CALCULATED') {
        return {
          field: 'isDisplayed',
          key: `${PREFIX}calculated-display`,
          values: { column: other.label },
        };
      }
    }
  }
  if (
    name === 'calculatedOrderQuantity' &&
    !draft.patientsTabEnabled &&
    !draft.requisitionReportOnly &&
    !column.isDisplayed
  ) {
    const requested = columns.requestedQuantity;
    const explanation = columns.requestedQuantityExplanation;
    if (requested && explanation && (!requested.isDisplayed || !explanation.isDisplayed)) {
      return {
        field: 'isDisplayed',
        key: `${PREFIX}requested-display`,
        values: {
          calculatedOrderQuantity: column.label,
          requestedQuantity: requested.label,
          requestedQuantityExplanation: explanation.label,
        },
      };
    }
  }
}

function rowError(key: string, draft: TemplateDraft, columns: NamedColumns): RowError | undefined {
  const column = draft.columns[key];
  const definition = draft.columnDefinitions[key];
  if (empty(column.label)) return { field: 'label', key: `${PREFIX}label-required` };
  if (column.label.length < 2) return { field: 'label', key: `${PREFIX}label-short` };
  if (!UTF8_REGEX.test(column.label)) return { field: 'label', key: `${PREFIX}label-characters` };
  if (column.definition === undefined || (column.definition && column.definition.length > 140))
    return { field: 'definition', key: `${PREFIX}definition-long` };
  if (empty(column.source)) return { field: 'source', key: `${PREFIX}source-required` };
  if (column.isDisplayed && definition.options.length && !column.optionId)
    return { field: 'optionId', key: `${PREFIX}option-required` };
  if (column.source === 'CALCULATED') {
    const dependencies = circularDependencies(definition.name, columns);
    if (dependencies.length)
      return {
        field: 'source',
        key: `${PREFIX}calculated-cycle`,
        values: { columns: dependencies.map((name) => ` ${columns[name].label}`).join(',') },
      };
  }
  if (
    !draft.patientsTabEnabled &&
    !draft.requisitionReportOnly &&
    !column.isDisplayed &&
    column.source === 'USER_INPUT' &&
    definition.sources.length > 1
  )
    return { field: 'isDisplayed', key: `${PREFIX}user-input-display` };
  const specific = columnRule(definition.name, column, draft, columns);
  if (specific) return specific;
  if (draft.populateStockOnHandFromStockCards && definition.supportsTag && empty(column.tag))
    return { field: 'tag', key: `${PREFIX}tag-required` };
  if (!draft.populateStockOnHandFromStockCards && column.source === 'STOCK_CARDS')
    return { field: 'source', key: `${PREFIX}stock-cards` };
}

function namedColumns(draft: TemplateDraft) {
  return Object.fromEntries(
    Object.entries(draft.columns).map(([key, column]) => [
      draft.columnDefinitions[key].name,
      column,
    ]),
  );
}

export function getRowErrors(draft: TemplateDraft): Record<string, RowError> {
  const columns = namedColumns(draft);
  const errors: Record<string, RowError> = {};
  for (const key of columnOrder(draft)) {
    const error = rowError(key, draft, columns);
    if (error) errors[key] = error;
  }
  return errors;
}

export function getNameError(draft: Pick<TemplateDraft, 'name'>): TemplateError | undefined {
  if (!draft.name.trim()) return { key: 'requisition-templates.form.name-required' };
  if (draft.name.length > 255) return { key: 'requisition-templates.form.name-too-long' };
}
