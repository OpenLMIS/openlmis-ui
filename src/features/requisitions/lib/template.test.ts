import { describe, expect, it } from 'vitest';
import { column } from '@/features/requisitions/lib/fixtures/builders';
import { compileColumns } from '@/features/requisitions/lib/template';

const names = [
  'skipped',
  'orderable.productCode',
  'orderable.fullProductName',
  'orderable.dispensable.displayUnit',
  'requestedQuantity',
  'requestedQuantityExplanation',
  'packsToShip',
  'approvedQuantity',
  'remarks',
  'calculatedOrderQuantityIsa',
  'totalReceivedQuantity',
];
const template = {
  columnsMap: Object.fromEntries(
    names.map((name, i) => [
      name,
      column(name, i, {
        indicator: name === 'skipped' || name === 'calculatedOrderQuantityIsa' ? 'S' : name,
      }),
    ]),
  ),
};
const context = { tab: 'fullSupply' as const, status: 'AUTHORIZED' as const, emergency: false };
const compiledNames = (overrides = {}) =>
  compileColumns(template, { ...context, ...overrides }).map((c) => c.name);

describe('compileColumns', () => {
  it('orders by displayOrder, keys S columns by name and inserts Pack Size after name', () => {
    expect(compiledNames()).toEqual([...names.slice(0, 3), 'packSize', ...names.slice(3)]);
    expect(
      compileColumns(template, context)
        .filter((c) => c.indicator === 'S')
        .map((c) => c.name),
    ).toEqual(['skipped', 'calculatedOrderQuantityIsa']);
  });
  it.each(['AUTHORIZED', 'IN_APPROVAL', 'APPROVED', 'RELEASED', 'RELEASED_WITHOUT_ORDER'])(
    'shows approval columns in %s',
    (status) => {
      expect(compiledNames({ status })).toContain('approvedQuantity');
      expect(compiledNames({ status })).toContain('remarks');
    },
  );
  it('hides approval columns before authorization, including received on patients templates', () => {
    expect(compiledNames({ status: 'SUBMITTED' })).not.toContain('approvedQuantity');
    expect(
      compileColumns(
        { ...template, patientsTabEnabled: true },
        { ...context, status: 'INITIATED' },
      ).map((c) => c.name),
    ).not.toContain('totalReceivedQuantity');
  });
  it.each([{ tab: 'nonFullSupply' }, { emergency: true }])(
    'restricts subsets and keeps Unit: %j',
    (overrides) => {
      expect(compiledNames(overrides)).toEqual([
        'orderable.productCode',
        'orderable.fullProductName',
        'packSize',
        'orderable.dispensable.displayUnit',
        'requestedQuantity',
        'requestedQuantityExplanation',
        'packsToShip',
        'approvedQuantity',
        'remarks',
      ]);
    },
  );
  it('honors packs options and inserts supplying stock after the closest lower displayed order', () => {
    const t = {
      columnsMap: {
        ...template.columnsMap,
        packsToShip: column('packsToShip', 6, {
          option: { optionName: 'showPackToShipInApprovalPage' },
        }),
        supplyingFacilityStockOnHand: column('supplyingFacilityStockOnHand', 5.5),
      },
    };
    expect(compileColumns(t, { ...context, status: 'SUBMITTED' }).map((c) => c.name)).not.toContain(
      'packsToShip',
    );
    expect(
      compileColumns(t, { ...context, supplyingStock: true })
        .map((c) => c.name)
        .slice(6, 9),
    ).toEqual(['requestedQuantityExplanation', 'supplyingFacilityStockOnHand', 'packsToShip']);
    t.columnsMap.packsToShip.option = { optionName: 'showPackToShipInAllPages' };
    expect(compileColumns(t, { ...context, status: 'INITIATED' }).map((c) => c.name)).toContain(
      'packsToShip',
    );
    expect(compileColumns(t, context).map((c) => c.name)).not.toContain(
      'supplyingFacilityStockOnHand',
    );
  });
  it('marks conversion, input, sticky and stock-based adjustments policies', () => {
    const result = compileColumns(
      {
        columnsMap: {
          totalLossesAndAdjustments: column('totalLossesAndAdjustments', 1, {
            source: 'USER_INPUT',
            definition: 'Snapshot',
          }),
        },
      },
      { ...context, stockBased: true },
    );
    expect(result[0]).toMatchObject({
      kind: 'adjustments',
      convertsToPacks: true,
      userInput: true,
    });
    expect(result[0]).toMatchObject({ definition: 'Snapshot', stockBasedNote: true });
  });
});

it('keeps the backend dispensable column as Unit on emergency and non-full grids', () => {
  const t = { columnsMap: { dispensable: column('dispensable', 1, { source: 'REFERENCE_DATA' }) } };
  expect(compileColumns(t, { ...context, tab: 'nonFullSupply' })).toMatchObject([
    { name: 'dispensable', kind: 'unit' },
  ]);
  expect(compileColumns(t, { ...context, emergency: true })).toMatchObject([
    { name: 'dispensable', kind: 'unit' },
  ]);
});
