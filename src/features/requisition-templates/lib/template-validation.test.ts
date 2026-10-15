import { describe, expect, it } from 'vitest';
import { buildNewTemplate } from '@/features/requisition-templates/lib/new-template';
import {
  draftFromTemplate,
  type TemplateDraft,
} from '@/features/requisition-templates/lib/template-draft';
import {
  getNameError,
  getRowErrors,
} from '@/features/requisition-templates/lib/template-validation';
import { liveCatalog, liveTemplates } from '@/features/requisition-templates/lib/test-templates';

function base() {
  const draft = draftFromTemplate(
    buildNewTemplate(liveCatalog, {
      name: 'Template',
      programId: 'p',
      facilityTypeIds: [],
      requisitionReportOnly: false,
    }),
  );
  for (const column of Object.values(draft.columns)) column.source = 'REFERENCE_DATA';
  return draft;
}
function row(draft: TemplateDraft, name: string) {
  const key = Object.keys(draft.columnDefinitions).find(
    (key) => draft.columnDefinitions[key].name === name,
  );
  if (!key) throw new Error(name);
  return { key, column: draft.columns[key], definition: draft.columnDefinitions[key] };
}
function error(draft: TemplateDraft, name: string) {
  return getRowErrors(draft)[row(draft, name).key];
}
const prefix = 'requisition-templates.configure.validation.';

describe('saved legacy templates', () => {
  it.each(liveTemplates.map((template) => [template.name, template] as const))(
    '%s has no legacy errors',
    (_, template) => {
      expect(getRowErrors(draftFromTemplate(template))).toEqual({});
      expect(getRowErrors(draftFromTemplate(template))).toEqual({});
      expect(getNameError(draftFromTemplate(template))).toBeUndefined();
    },
  );
  it('retains the one legacy error in FM-148 defaults', () => {
    const draft = draftFromTemplate(
      buildNewTemplate(liveCatalog, {
        name: 'New',
        programId: 'p',
        facilityTypeIds: [],
        requisitionReportOnly: false,
      }),
    );
    expect(getRowErrors(draft)).toEqual({
      [row(draft, 'averageConsumption').key]: { field: 'source', key: `${prefix}stock-cards` },
    });
  });
});

it('returns the first failed field in legacy order and clears each repaired error', () => {
  const draft = base();
  const { column, definition } = row(draft, 'skipped');
  Object.assign(column, { label: '', definition: 'a'.repeat(141), source: '', optionId: null });
  for (const [label, key] of [
    ['', 'label-required'],
    ['a', 'label-short'],
    [' ab', 'label-characters'],
    ['😀a', 'label-characters'],
    ['a\nb', 'label-characters'],
  ]) {
    column.label = label;
    expect(error(draft, 'skipped')).toEqual({ field: 'label', key: prefix + key });
  }
  column.label = 'العربية';
  expect(error(draft, 'skipped')?.field).toBe('definition');
  column.definition = '';
  expect(error(draft, 'skipped')?.field).toBe('source');
  column.source = 'REFERENCE_DATA';
  expect(error(draft, 'skipped')).toEqual({ field: 'optionId', key: `${prefix}option-required` });
  column.optionId = definition.options[0].id;
  expect(error(draft, 'skipped')).toBeUndefined();
  column.optionId = null;
  column.isDisplayed = false;
  expect(error(draft, 'skipped')).toBeUndefined();
});

it('finds calculated cycles through hidden rows, including patients, and uses current closing-parent labels', () => {
  const draft = base();
  const consumed = row(draft, 'totalConsumedQuantity').column;
  const stock = row(draft, 'stockOnHand').column;
  Object.assign(consumed, { source: 'CALCULATED', label: 'Consumption now', isDisplayed: false });
  Object.assign(stock, { source: 'CALCULATED', label: 'Stock now', isDisplayed: false });
  draft.patientsTabEnabled = true;
  expect(error(draft, 'totalConsumedQuantity')).toEqual({
    field: 'source',
    key: `${prefix}calculated-cycle`,
    values: { columns: ' Stock now' },
  });
  stock.source = 'USER_INPUT';
  expect(error(draft, 'totalConsumedQuantity')).toBeUndefined();
});

it('requires multisource user input to display, with exactly the legacy exemptions', () => {
  const draft = base();
  const { column, definition } = row(draft, 'stockOnHand');
  Object.assign(column, { source: 'USER_INPUT', isDisplayed: false });
  expect(error(draft, 'stockOnHand')).toEqual({
    field: 'isDisplayed',
    key: `${prefix}user-input-display`,
  });
  draft.patientsTabEnabled = true;
  expect(error(draft, 'stockOnHand')).toBeUndefined();
  draft.patientsTabEnabled = false;
  draft.requisitionReportOnly = true;
  expect(error(draft, 'stockOnHand')).toBeUndefined();
  draft.requisitionReportOnly = false;
  definition.sources = ['USER_INPUT'];
  expect(error(draft, 'stockOnHand')).toBeUndefined();
  column.isDisplayed = true;
  expect(error(draft, 'stockOnHand')).toBeUndefined();
});

it.each([
  ['', 'periods-required'],
  ['0', 'periods-required'],
  ['٠', 'periods-required'],
  ['1', 'periods-minimum'],
  ['1.5', 'periods-whole'],
  ['2e2', 'periods-whole'],
  ['abc', 'periods-whole'],
  ['2147483648', 'periods-too-large'],
])('validates periods %s even on hidden patients rows', (value, key) => {
  const draft = base();
  draft.patientsTabEnabled = true;
  draft.numberOfPeriodsToAverage = value;
  expect(error(draft, 'averageConsumption')).toEqual({
    field: 'numberOfPeriodsToAverage',
    key: prefix + key,
  });
  draft.numberOfPeriodsToAverage = '٢';
  expect(error(draft, 'averageConsumption')).toBeUndefined();
  draft.numberOfPeriodsToAverage = '۳';
  expect(error(draft, 'averageConsumption')).toBeUndefined();
});

it.each([
  ['requestedQuantity', 'requestedQuantityExplanation'],
  ['requestedQuantityExplanation', 'requestedQuantity'],
  ['additionalQuantityRequired', 'adjustedConsumption'],
])('pairs %s with %s even for patients and report only', (name, other) => {
  const draft = base();
  draft.patientsTabEnabled = true;
  draft.requisitionReportOnly = true;
  row(draft, name).column.isDisplayed = true;
  Object.assign(row(draft, other).column, { isDisplayed: false, label: 'Current label' });
  expect(error(draft, name)).toEqual({
    field: 'isDisplayed',
    key: `${prefix}display-mismatch`,
    values: { column: 'Current label' },
  });
  row(draft, other).column.isDisplayed = true;
  expect(error(draft, name)).toBeUndefined();
  row(draft, other).column.isDisplayed = false;
  row(draft, name).column.isDisplayed = false;
  expect(error(draft, name)).toBeUndefined();
});

it('checks hidden stockout against adjusted consumption before average consumption, except patients', () => {
  const draft = base();
  row(draft, 'totalStockoutDays').column.isDisplayed = false;
  for (const name of ['adjustedConsumption', 'averageConsumption'])
    Object.assign(row(draft, name).column, {
      source: 'CALCULATED',
      isDisplayed: true,
      label: name,
    });
  draft.requisitionReportOnly = true;
  expect(error(draft, 'totalStockoutDays')?.values).toEqual({ column: 'adjustedConsumption' });
  row(draft, 'adjustedConsumption').column.isDisplayed = false;
  expect(error(draft, 'totalStockoutDays')).toEqual({
    field: 'isDisplayed',
    key: `${prefix}calculated-display`,
    values: { column: 'averageConsumption' },
  });
  draft.patientsTabEnabled = true;
  expect(error(draft, 'totalStockoutDays')).toBeUndefined();
  draft.patientsTabEnabled = false;
  row(draft, 'totalStockoutDays').column.isDisplayed = true;
  expect(error(draft, 'totalStockoutDays')).toBeUndefined();
});

it.each(['requestedQuantity', 'requestedQuantityExplanation'])(
  'requires %s when order quantity is hidden, except patients/report only',
  (name) => {
    const draft = base();
    row(draft, 'calculatedOrderQuantity').column.isDisplayed = false;
    row(draft, name).column.isDisplayed = false;
    expect(error(draft, 'calculatedOrderQuantity')).toEqual({
      field: 'isDisplayed',
      key: `${prefix}requested-display`,
      values: {
        calculatedOrderQuantity: row(draft, 'calculatedOrderQuantity').column.label,
        requestedQuantity: row(draft, 'requestedQuantity').column.label,
        requestedQuantityExplanation: row(draft, 'requestedQuantityExplanation').column.label,
      },
    });
    draft.patientsTabEnabled = true;
    expect(error(draft, 'calculatedOrderQuantity')).toBeUndefined();
    draft.patientsTabEnabled = false;
    draft.requisitionReportOnly = true;
    expect(error(draft, 'calculatedOrderQuantity')).toBeUndefined();
    draft.requisitionReportOnly = false;
    row(draft, name).column.isDisplayed = true;
    expect(error(draft, 'calculatedOrderQuantity')).toBeUndefined();
  },
);

it('checks tags on hidden patients rows, after column rules and before stock-card source', () => {
  const draft = base();
  draft.patientsTabEnabled = true;
  draft.populateStockOnHandFromStockCards = true;
  const column = row(draft, 'totalReceivedQuantity').column;
  Object.assign(column, { isDisplayed: false, tag: ' ', source: 'STOCK_CARDS' });
  expect(error(draft, 'totalReceivedQuantity')).toEqual({
    field: 'tag',
    key: `${prefix}tag-required`,
  });
  column.tag = 'Received';
  expect(error(draft, 'totalReceivedQuantity')).toBeUndefined();
  draft.populateStockOnHandFromStockCards = false;
  expect(error(draft, 'totalReceivedQuantity')).toEqual({
    field: 'source',
    key: `${prefix}stock-cards`,
  });
  column.source = 'REFERENCE_DATA';
  column.tag = null;
  expect(error(draft, 'totalReceivedQuantity')).toBeUndefined();
});

it('enforces only required name and length in settings', () => {
  const draft = base();
  expect(getRowErrors(draft)).toEqual({});
  expect(getNameError(draft)).toBeUndefined();
  draft.name = '  ';
  expect(getNameError(draft)?.key).toBe('requisition-templates.form.name-required');
  expect(getRowErrors(draft)).toEqual({});
  draft.name = 'a'.repeat(256);
  expect(getNameError(draft)?.key).toBe('requisition-templates.form.name-too-long');
  draft.name = 'a'.repeat(255);
  expect(getRowErrors(draft)).toEqual({});
  expect(getNameError(draft)).toBeUndefined();
});

it('keeps user-input, column-specific, tag and stock errors in legacy priority', () => {
  const draft = base();
  const { column, definition } = row(draft, 'averageConsumption');
  definition.supportsTag = true;
  Object.assign(column, { source: 'USER_INPUT', isDisplayed: false, tag: null });
  draft.numberOfPeriodsToAverage = '';
  draft.populateStockOnHandFromStockCards = true;
  expect(error(draft, 'averageConsumption')?.key).toBe(`${prefix}user-input-display`);
  column.isDisplayed = true;
  expect(error(draft, 'averageConsumption')?.key).toBe(`${prefix}periods-required`);
  draft.numberOfPeriodsToAverage = '3';
  expect(error(draft, 'averageConsumption')?.key).toBe(`${prefix}tag-required`);
  column.tag = 'Average';
  expect(error(draft, 'averageConsumption')).toBeUndefined();
  column.source = 'STOCK_CARDS';
  draft.populateStockOnHandFromStockCards = false;
  draft.numberOfPeriodsToAverage = '';
  expect(error(draft, 'averageConsumption')?.key).toBe(`${prefix}periods-required`);
  draft.numberOfPeriodsToAverage = '3';
  expect(error(draft, 'averageConsumption')?.key).toBe(`${prefix}stock-cards`);
});

it('retains legacy undefined description failure but accepts null and the 140-character boundary', () => {
  const draft = base();
  const { column } = row(draft, 'stockOnHand');
  column.definition = undefined;
  expect(error(draft, 'stockOnHand')).toEqual({
    field: 'definition',
    key: `${prefix}definition-long`,
  });
  column.definition = null;
  expect(error(draft, 'stockOnHand')).toBeUndefined();
  column.definition = 'a'.repeat(140);
  expect(error(draft, 'stockOnHand')).toBeUndefined();
});
