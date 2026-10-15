import { expect, it } from 'vitest';
import { buildNewTemplate } from '@/features/requisition-templates/lib/new-template';
import type { ColumnDefinition } from '@/features/requisition-templates/lib/types';

const option = { id: 'o', optionName: 'default', optionLabel: 'label.key' };
const column = (name: string, canChangeOrder = true): ColumnDefinition => ({
  id: name,
  name,
  canChangeOrder,
  columnType: 'NUMERIC',
  label: name,
  indicator: 'A',
  definition: 'Definition',
  mandatory: false,
  isDisplayRequired: false,
  canBeChangedByUser: false,
  supportsTag: false,
  sources: ['STOCK_CARDS', 'USER_INPUT'],
  options: [option],
});
it('builds legacy defaults with locked columns first and preserves whole catalog definitions and options', () => {
  const catalog = [
    column('movable'),
    column('orderable.fullProductName', false),
    column('otherLocked', false),
    column('skipped', false),
    column('orderable.productCode', false),
    { ...column('averageConsumption'), sources: ['STOCK_CARDS', 'CALCULATED'] as const },
    column('calculatedOrderQuantityIsa'),
  ];
  const body = buildNewTemplate(catalog, {
    name: ' Name ',
    programId: 'p',
    facilityTypeIds: ['t'],
    requisitionReportOnly: true,
  });
  const columns = Object.values(body.columnsMap);
  expect(columns.map(({ name }) => name)).toEqual([
    'skipped',
    'orderable.productCode',
    'orderable.fullProductName',
    'otherLocked',
    'movable',
    'averageConsumption',
    'calculatedOrderQuantityIsa',
  ]);
  expect(columns.map(({ displayOrder }) => displayOrder)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(columns.filter(({ isDisplayed }) => !isDisplayed).map(({ name }) => name)).toEqual([
    'averageConsumption',
    'calculatedOrderQuantityIsa',
  ]);
  expect(body.columnsMap.movable.source).toBe('USER_INPUT');
  expect(body.columnsMap.averageConsumption.source).toBe('STOCK_CARDS');
  expect(body.columnsMap.movable.columnDefinition).toBe(catalog[0]);
  expect(body.columnsMap.movable.option).toBe(option);
  expect(body).toMatchObject({
    name: 'Name',
    program: { id: 'p' },
    facilityTypes: [{ id: 't' }],
    numberOfPeriodsToAverage: 3,
    populateStockOnHandFromStockCards: false,
    patientsTabEnabled: false,
    rejectionReasonWindowVisible: false,
  });
  expect(
    buildNewTemplate([{ ...column('noOption'), options: [] }], {
      name: 'x',
      programId: 'p',
      facilityTypeIds: ['t'],
      requisitionReportOnly: false,
    }).columnsMap.noOption,
  ).not.toHaveProperty('option');
});
