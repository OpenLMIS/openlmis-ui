import { expect, it } from 'vitest';
import {
  applyDraft,
  draftFromTemplate,
  setDisplayed,
  setStockFlag,
  tagChoices,
} from '@/features/requisition-templates/lib/template-draft';
import { liveTemplates } from '@/features/requisition-templates/lib/test-templates';

it('keys dotted columns by definition id and applies edits onto the latest whole record', () => {
  const original = liveTemplates[0];
  const draft = draftFromTemplate(original);
  const name = 'orderable.productCode';
  const key = original.columnsMap[name].columnDefinition.id;
  expect(draft.columns[name]).toBeUndefined();
  draft.columns[key].label = 'Edited code';
  draft.name = 'Edited name';
  draft.numberOfPeriodsToAverage = '۳';
  draft.facilityTypeIds = ['inactive'];
  draft.columns[key].displayOrder = 99;
  const latest = {
    ...original,
    serverField: 'new',
    enableAvgConsumptionForCurrentPeriod: true,
    columnsMap: {
      ...original.columnsMap,
      [name]: { ...original.columnsMap[name], serverColumnField: 'new' },
    },
  };
  const result = applyDraft(latest, draft);
  expect(result).toMatchObject({
    serverField: 'new',
    enableAvgConsumptionForCurrentPeriod: true,
    name: 'Edited name',
    numberOfPeriodsToAverage: 3,
    facilityTypes: [{ id: 'inactive' }],
  });
  expect(result.columnsMap[name]).toMatchObject({
    label: 'Edited code',
    displayOrder: 99,
    serverColumnField: 'new',
  });
  expect(result.columnsMap[name].columnDefinition).toBe(latest.columnsMap[name].columnDefinition);
  expect(latest.columnsMap[name].label).toBe(original.columnsMap[name].label);
  expect(original.name).not.toBe(draft.name);
});
it('resolves whole options from the latest definition and sends null for cleared values', () => {
  const template = structuredClone(liveTemplates[0]);
  const column = Object.values(template.columnsMap).find(
    (column) => column.columnDefinition.options.length,
  );
  if (!column) throw new Error('Missing option fixture');
  const draft = draftFromTemplate(template);
  const key = column.columnDefinition.id;
  const option = {
    ...column.columnDefinition.options[0],
    optionLabel: 'latest',
    extra: 'preserved',
  };
  column.columnDefinition.options = [option];
  draft.columns[key].optionId = option.id;
  expect(applyDraft(template, draft).columnsMap[column.name].option).toBe(option);
  draft.columns[key].optionId = null;
  draft.numberOfPeriodsToAverage = ' ';
  expect(applyDraft(template, draft).columnsMap[column.name].option).toBeNull();
  expect(applyDraft(template, draft).numberOfPeriodsToAverage).toBeNull();
  draft.columns[key].optionId = 'removed';
  expect(applyDraft(template, draft).columnsMap[column.name].option).toBeNull();
});
it('sets only the seven stock sources where offered and preserves displays and tags', () => {
  const template = liveTemplates.find((template) => template.populateStockOnHandFromStockCards);
  if (!template) throw new Error('Missing stock fixture');
  const draft = draftFromTemplate(template);
  const off = setStockFlag(draft, false);
  const on = setStockFlag(off, true);
  const stockNames = [
    'beginningBalance',
    'stockOnHand',
    'totalLossesAndAdjustments',
    'totalConsumedQuantity',
    'totalReceivedQuantity',
    'totalStockoutDays',
    'averageConsumption',
  ];
  for (const [key, definition] of Object.entries(draft.columnDefinitions)) {
    const stock =
      stockNames.includes(definition.name) && definition.sources.includes('STOCK_CARDS');
    expect(on.columns[key].source).toBe(stock ? 'STOCK_CARDS' : draft.columns[key].source);
    expect(off.columns[key].source).toBe(
      stock
        ? definition.sources.includes('USER_INPUT')
          ? 'USER_INPUT'
          : definition.sources.find((source) => source !== 'STOCK_CARDS')
        : draft.columns[key].source,
    );
    expect(on.columns[key].isDisplayed).toBe(draft.columns[key].isDisplayed);
    expect(on.columns[key].tag).toBe(draft.columns[key].tag);
  }
  expect(off.populateStockOnHandFromStockCards).toBe(false);
  expect(on.populateStockOnHandFromStockCards).toBe(true);
  expect(draft.populateStockOnHandFromStockCards).toBe(true);
});
it('couples TC display only on user changes when both sources are offered', () => {
  const template = liveTemplates.find((template) => template.name === 'TB Monthly');
  if (!template) throw new Error('Missing patients fixture');
  const draft = draftFromTemplate(template);
  const key = template.columnsMap.numberOfPatientsOnTreatmentNextMonth.columnDefinition.id;
  expect(draft.columns[key].source).toBe('CALCULATED');
  expect(draft.columns[key].isDisplayed).toBe(true);
  const shown = setDisplayed(draft, key, true);
  expect(shown.columns[key].source).toBe('USER_INPUT');
  expect(setDisplayed(shown, key, false).columns[key]).toMatchObject({
    source: 'CALCULATED',
    isDisplayed: false,
  });
  draft.columnDefinitions[key].sources = ['REFERENCE_DATA'];
  expect(setDisplayed(draft, key, false).columns[key].source).toBe('CALCULATED');
});
it('sorts available tags, excluding other selections and retaining its own retired tag', () => {
  const draft = draftFromTemplate(liveTemplates[0]);
  const [own, other] = Object.keys(draft.columns);
  draft.columns[own].tag = 'retired';
  draft.columns[other].tag = 'used';
  expect(tagChoices(draft, own, ['z', 'used', 'a'])).toEqual(['a', 'retired', 'z']);
  expect(tagChoices(draft, own, ['retired', 'a', 'used'])).toEqual(['a', 'retired']);
});

it('restores stock columns without a stock-card source and leaves them unchanged when enabling', () => {
  const draft = draftFromTemplate(liveTemplates[0]);
  const key = Object.keys(draft.columnDefinitions).find(
    (key) => draft.columnDefinitions[key].name === 'stockOnHand',
  );
  if (!key) throw new Error('Missing stock column');
  draft.columnDefinitions[key].sources = ['CALCULATED', 'USER_INPUT'];
  draft.columns[key].source = 'CALCULATED';
  expect(setStockFlag(draft, true).columns[key].source).toBe('CALCULATED');
  expect(setStockFlag(draft, false).columns[key].source).toBe('USER_INPUT');
  draft.columnDefinitions[key].sources = ['REFERENCE_DATA', 'CALCULATED'];
  expect(setStockFlag(draft, false).columns[key].source).toBe('REFERENCE_DATA');
});

it('preserves freshly reread display orders unless the draft actually moved a column', () => {
  const latest = structuredClone(liveTemplates[0]);
  const draft = draftFromTemplate(latest);
  const column = Object.values(latest.columnsMap)[0];
  column.displayOrder = 100;
  expect(applyDraft(latest, draft).columnsMap[column.name].displayOrder).toBe(100);
  const key = column.columnDefinition.id;
  draft.columns[key].displayOrder = 101;
  expect(applyDraft(latest, draft).columnsMap[column.name].displayOrder).toBe(101);
});
