import { describe, expect, it } from 'vitest';
import {
  calculateLine,
  calculateTotals,
  displayQuantity,
  packsToShip,
} from '@/features/requisitions/lib/calculations';
import { column, line, product, record } from '@/features/requisitions/lib/fixtures/builders';
import liveRecords from '@/features/requisitions/lib/fixtures/legacy-totals.json';
import { buildLines } from '@/features/requisitions/lib/lines';
import type {
  Requisition,
  RequisitionApprovedProduct,
  RequisitionProduct,
} from '@/features/requisitions/lib/requisition';

const calculated = [
  'totalLossesAndAdjustments',
  'stockOnHand',
  'totalConsumedQuantity',
  'total',
  'adjustedConsumption',
  'averageConsumption',
  'maximumStockQuantity',
  'calculatedOrderQuantity',
  'calculatedOrderQuantityIsa',
];
const template = { columnsMap: Object.fromEntries(calculated.map((name) => [name, column(name)])) };
function calculate(
  overrides = {},
  r: Partial<Requisition> = {},
  p: Partial<RequisitionProduct> = {},
) {
  const requisition = record({ template, requisitionLineItems: [line(overrides)], ...r });
  const model = buildLines(
    requisition,
    [product(p)],
    [{ id: 'approved', meta: { versionNumber: 1 }, maxPeriodsOfStock: 2.5 }],
  )[0];
  if (!model) throw new Error('Missing model');
  return calculateLine(model, requisition, 1);
}

describe('server display calculations', () => {
  it.each([
    [15, 10, 5, false, 1],
    [16, 10, 5, false, 2],
    [5, 10, 5, false, 1],
    [5, 10, 5, true, 0],
    [0, 10, 5, false, 0],
    [-1, 10, 5, false, 0],
    [10, 0, 5, false, 0],
  ])('rounds packs (%s/%s threshold %s, zero %s)', (q, size, threshold, zero, expected) => {
    expect(packsToShip(q as number, size as number, threshold as number, zero as boolean)).toBe(
      expected,
    );
  });
  it('calculates D E C Y N P H I S in dependency order without changing inputs', () => {
    const input = {
      beginningBalance: 10,
      totalReceivedQuantity: 4,
      totalConsumedQuantity: 5,
      idealStockAmount: 30,
      stockAdjustments: [
        { reasonId: 'credit', quantity: 3 },
        { reasonId: 'debit', quantity: 1 },
        { reasonId: 'missing', quantity: 100 },
      ],
    };
    const result = calculate(input, {
      stockAdjustmentReasons: [
        { reasonId: 'credit', reasonType: 'CREDIT', name: 'Hidden Credit', hidden: true },
        { reasonId: 'debit', reasonType: 'DEBIT' },
      ],
    });
    expect(result).toMatchObject({
      totalLossesAndAdjustments: 2,
      stockOnHand: 11,
      totalConsumedQuantity: 5,
      total: 14,
      adjustedConsumption: 5,
      averageConsumption: 5,
      maximumStockQuantity: 13,
      calculatedOrderQuantity: 2,
      calculatedOrderQuantityIsa: 19,
    });
    expect(input.totalConsumedQuantity).toBe(5);
  });
  it('uses zero N at C=0, current-period ceil(N/2), historical averages and half-up H', () => {
    expect(
      calculate({ totalConsumedQuantity: 0, additionalQuantityRequired: 50 }).adjustedConsumption,
    ).toBe(0);
    expect(
      calculate(
        { totalConsumedQuantity: 5 },
        { template: { ...template, enableAvgConsumptionForCurrentPeriod: true } },
      ),
    ).toMatchObject({ averageConsumption: 3, maximumStockQuantity: 8 });
    expect(
      calculate({ totalConsumedQuantity: 5, previousAdjustedConsumptions: [3, 2] })
        .averageConsumption,
    ).toBe(4);
  });
  it('does not add a spurious dose at an exact rational boundary or add Z during complete stockout', () => {
    expect(calculate({ totalConsumedQuantity: 7, totalStockoutDays: 23 }).adjustedConsumption).toBe(
      30,
    );
    expect(
      calculate({ totalConsumedQuantity: 7, totalStockoutDays: 30, additionalQuantityRequired: 12 })
        .adjustedConsumption,
    ).toBe(7);
  });
  it.each(['INITIATED', 'REJECTED', 'SUBMITTED'])(
    'uses requested quantity even with its column hidden in %s',
    (status) => {
      expect(
        calculate(
          { requestedQuantity: 16, approvedQuantity: 100 },
          { status: status as Requisition['status'] },
        ).packsToShip,
      ).toBe(2);
      expect(
        calculate({ requestedQuantity: 0 }, { status: status as Requisition['status'] })
          .packsToShip,
      ).toBe(0);
    },
  );
  it.each([
    'AUTHORIZED',
    'IN_APPROVAL',
    'APPROVED',
    'RELEASED',
    'RELEASED_WITHOUT_ORDER',
    'SKIPPED',
  ])('uses approved or zero in %s', (status) => {
    expect(
      calculate(
        { requestedQuantity: 100, approvedQuantity: 16 },
        { status: status as Requisition['status'] },
      ).packsToShip,
    ).toBe(2);
    expect(
      calculate({ requestedQuantity: 100 }, { status: status as Requisition['status'] })
        .packsToShip,
    ).toBe(0);
  });
  it('preserves stock-card/user input and skipped/emergency/non-full calculations but still prices non-skipped lines', () => {
    const t = {
      populateStockOnHandFromStockCards: true,
      columnsMap: Object.fromEntries(
        calculated.map((name) => [name, column(name, 0, { source: 'STOCK_CARDS' })]),
      ),
    };
    expect(
      calculate({ calculatedOrderQuantityIsa: 16, totalLossesAndAdjustments: 88 }, { template: t }),
    ).toMatchObject({ totalLossesAndAdjustments: 88, packsToShip: 2 });
    expect(
      calculate({ adjustedConsumption: 99, requestedQuantity: 16 }, { emergency: true }),
    ).toMatchObject({ adjustedConsumption: 99, totalCost: 4 });
    expect(
      calculate(
        { adjustedConsumption: 99, requestedQuantity: 16 },
        {},
        { programs: [{ programId: 'program', fullSupply: false, pricePerPack: 2 }] },
      ),
    ).toMatchObject({ adjustedConsumption: 99, totalCost: 4 });
    expect(calculate({ skipped: true, totalCost: 100, adjustedConsumption: 99 })).toMatchObject({
      totalCost: 100,
      adjustedConsumption: 99,
    });
  });
  it('takes the last duplicate program price and excludes skipped lines from raw subtotals', () => {
    const r = record({
      requisitionLineItems: [
        line({ requestedQuantity: 20 }),
        line({ id: 'skip', skipped: true, totalCost: 50 }),
      ],
    });
    const models = buildLines(r, [
      product({
        programs: [
          { programId: 'program', fullSupply: true, pricePerPack: 1 },
          { programId: 'program', fullSupply: false, pricePerPack: 1.234 },
        ],
      }),
    ]);
    expect(calculateTotals(models.map((m) => ({ ...m, line: calculateLine(m, r, 1) })))).toEqual({
      fullSupply: 0,
      nonFullSupply: 2.468,
      total: 2.468,
    });
  });
  it('keeps an approval TC override through TE to TH', () => {
    const t = {
      columnsMap: Object.fromEntries(
        [
          'numberOfPatientsOnTreatmentNextMonth',
          'totalRequirement',
          'totalQuantityNeededByHf',
          'quantityToIssue',
          'convertedQuantityToIssue',
        ].map((name) => [name, column(name)]),
      ),
    };
    expect(
      calculate(
        { numberOfPatientsOnTreatmentNextMonth: 3, stockOnHand: 5 },
        { status: 'AUTHORIZED', template: t },
        { programs: [{ programId: 'program', fullSupply: true, dosesPerPatient: 10 }] },
      ),
    ).toMatchObject({
      numberOfPatientsOnTreatmentNextMonth: 3,
      totalRequirement: 30,
      totalQuantityNeededByHf: 60,
      quantityToIssue: 55,
      convertedQuantityToIssue: 5,
    });
  });
  it.each(liveRecords)(
    'matches legacy total for $id',
    ({ requisition, products, approvedProducts, total }) => {
      const r = requisition as Requisition;
      const models = buildLines(
        r,
        products as RequisitionProduct[],
        approvedProducts as RequisitionApprovedProduct[],
      );
      expect(
        calculateTotals(models.map((m) => ({ ...m, line: calculateLine(m, r, 1) }))).total,
      ).toBeCloseTo(total, 2);
    },
  );
  it('uses each displayed patients input when deriving the next column', () => {
    const t = {
      columnsMap: {
        totalRequirement: column('totalRequirement', 0, { source: 'USER_INPUT' }),
        totalQuantityNeededByHf: column('totalQuantityNeededByHf'),
        quantityToIssue: column('quantityToIssue'),
        convertedQuantityToIssue: column('convertedQuantityToIssue'),
      },
    };
    expect(
      calculate(
        { totalRequirement: 40, stockOnHand: 5 },
        { template: t },
        { programs: [{ programId: 'program', fullSupply: true, dosesPerPatient: 10 }] },
      ),
    ).toMatchObject({
      totalRequirement: 40,
      totalQuantityNeededByHf: 80,
      quantityToIssue: 75,
      convertedQuantityToIssue: 7,
    });
  });
  it('matches the server ratio rounding, including its 1000-place division before ceiling', () => {
    expect(
      calculate({ totalConsumedQuantity: 11, totalStockoutDays: 19 }).adjustedConsumption,
    ).toBe(31);
  });
  it('uses shared packs display and preserves empty values', () => {
    expect(displayQuantity(-15, 10, 'PACKS')).toBe('-1 ( -5 )');
    expect(displayQuantity(null, 10, 'PACKS')).toBeNull();
  });
});
