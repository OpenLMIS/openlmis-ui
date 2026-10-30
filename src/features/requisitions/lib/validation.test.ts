import { expect, it } from 'vitest';
import { column, line, product, record } from '@/features/requisitions/lib/fixtures/builders';
import { buildLines } from '@/features/requisitions/lib/lines';
import type { RequisitionLineItem } from '@/features/requisitions/lib/requisition';
import { validateRequisition } from '@/features/requisitions/lib/validation';

const names = [
  'beginningBalance',
  'totalReceivedQuantity',
  'stockOnHand',
  'totalConsumedQuantity',
  'requestedQuantity',
  'requestedQuantityExplanation',
  'totalStockoutDays',
  'numberOfNewPatientsAdded',
];
function validate(
  values: Partial<RequisitionLineItem> = {},
  options: {
    fullSupply?: boolean;
    emergency?: boolean;
    stockBased?: boolean;
    calculated?: string[];
    hidden?: string[];
    months?: number;
  } = {},
) {
  const req = record({
    emergency: options.emergency ?? false,
    template: {
      populateStockOnHandFromStockCards: options.stockBased,
      columnsMap: Object.fromEntries(
        [...names, ...(options.calculated ?? [])].map((name) => [
          name,
          column(name, 0, {
            source: options.calculated?.includes(name) ? 'CALCULATED' : 'USER_INPUT',
            isDisplayed: !options.hidden?.includes(name),
            columnDefinition: { columnType: name.endsWith('Explanation') ? 'TEXT' : 'NUMERIC' },
          }),
        ]),
      ),
    },
    stockAdjustmentReasons: [{ id: 'credit', reasonType: 'CREDIT' }],
    requisitionLineItems: [
      line({
        beginningBalance: 10,
        totalReceivedQuantity: 5,
        stockOnHand: 10,
        totalConsumedQuantity: 5,
        totalStockoutDays: 0,
        requestedQuantity: 0,
        ...values,
      }),
    ],
  });
  return validateRequisition(
    req,
    buildLines(req, [
      product({ programs: [{ programId: 'program', fullSupply: options.fullSupply ?? true }] }),
    ]),
    {
      monthsInPeriod: options.months ?? 1,
    },
  );
}
it('requires shown input cells but not optional columns or skipped lines', () => {
  expect(validate({ beginningBalance: null }).lines.line.beginningBalance).toBe(
    'stock-events.required',
  );
  expect(
    validate({ beginningBalance: null }, { hidden: ['beginningBalance'] }).lines.line,
  ).not.toHaveProperty('beginningBalance');
  expect(validate({ skipped: true, beginningBalance: null })).toMatchObject({
    lines: {},
    errors: ['requisitions.edit.validation.all-skipped'],
  });
  expect(validate().lines).toEqual({});
});
it.each(['stockOnHand', 'totalConsumedQuantity'] as const)(
  'checks negative and balance on %s',
  (name) => {
    expect(validate({ [name]: -1 }).lines.line[name]).toBe('requisitions.edit.validation.negative');
    expect(validate({ [name]: 9 }).lines.line[name]).toBe('requisitions.edit.validation.balance');
    expect(validate({ [name]: 9 }, { stockBased: true }).lines).toEqual({});
    expect(
      validate({ beginningBalance: 0, totalReceivedQuantity: 0 }, { calculated: [name] }).lines
        .line[name],
    ).toBe('requisitions.edit.validation.negative');
  },
);
it('requires requested quantity by supply, emergency and visible calculated columns', () => {
  expect(validate({ requestedQuantity: null }).lines.line.requestedQuantity).toBe(
    'stock-events.required',
  );
  expect(
    validate({ requestedQuantity: null }, { calculated: ['calculatedOrderQuantity'] }).lines,
  ).toEqual({});
  for (const options of [{ fullSupply: false }, { emergency: true }])
    expect(
      validate({ requestedQuantity: null }, { ...options, calculated: ['calculatedOrderQuantity'] })
        .lines.line.requestedQuantity,
    ).toBe('stock-events.required');
});
it('requires an explanation only for differing full-supply requests with both columns shown', () => {
  const values = { requestedQuantity: 2, calculatedOrderQuantity: 1 };
  expect(
    validate(values, { calculated: ['calculatedOrderQuantity'] }).lines.line
      .requestedQuantityExplanation,
  ).toBe('stock-events.required');
  expect(
    validate(values, { fullSupply: false, calculated: ['calculatedOrderQuantity'] }).lines,
  ).toEqual({});
  expect(
    validate(values, {
      hidden: ['requestedQuantityExplanation'],
      calculated: ['calculatedOrderQuantity'],
    }).lines,
  ).toEqual({});
  expect(
    validate({ requestedQuantityExplanation: 'x'.repeat(256) }).lines.line
      .requestedQuantityExplanation,
  ).toBe('requisitions.edit.validation.explanation-length');
});
it('limits stockout days to the period and non-full validation to its subset', () => {
  expect(validate({ totalStockoutDays: 60 }, { months: 2 }).lines).toEqual({});
  expect(validate({ totalStockoutDays: 61 }, { months: 2 }).lines.line.totalStockoutDays).toBe(
    'requisitions.edit.validation.stockout-days',
  );
  expect(
    validate({ beginningBalance: null, totalStockoutDays: 61 }, { fullSupply: false }).lines,
  ).toEqual({});
});
it.each([1.5, 2147483648, Number.NaN])('rejects invalid whole numbers: %s', (requestedQuantity) => {
  expect(validate({ requestedQuantity }).lines.line.requestedQuantity).toBeTruthy();
});
it('requires adjustment quantities above zero and within the whole-number range', () => {
  for (const quantity of [0, -1, 1.5, 2147483648])
    expect(
      validate({ stockAdjustments: [{ reasonId: 'reason', quantity }] }).lines.line
        .stockAdjustments,
    ).toBeTruthy();
});
it('checks the integer range on calculated cells as well as inputs', () => {
  expect(
    validate({ maximumStockQuantity: 2147483658 }, { calculated: ['calculatedOrderQuantity'] })
      .lines.line.calculatedOrderQuantity,
  ).toBe('stock-events.number-too-large');
});
it('limits displayed remarks to 250 characters', () => {
  const req = record({
    status: 'AUTHORIZED',
    template: {
      columnsMap: {
        remarks: column('remarks', 0, {
          source: 'USER_INPUT',
          columnDefinition: { columnType: 'TEXT' },
        }),
      },
    },
    requisitionLineItems: [line({ remarks: 'x'.repeat(251) })],
  });
  expect(
    validateRequisition(req, buildLines(req, [product()]), {
      monthsInPeriod: 1,
    }).lines.line.remarks,
  ).toBe('requisitions.edit.validation.remarks-length');
});

it('validates balance against the adjustments as edited rather than the stored total', () => {
  const values = {
    totalLossesAndAdjustments: 0,
    stockAdjustments: [{ reasonId: 'credit', quantity: 2 }],
  };
  expect(validate(values).lines.line.stockOnHand).toBe('requisitions.edit.validation.balance');
  expect(validate({ ...values, stockOnHand: 12 }).lines).toEqual({});
});
it('requires explanation against the newly calculated quantity', () => {
  const options = { calculated: ['calculatedOrderQuantity'] };
  expect(
    validate({ requestedQuantity: 2, calculatedOrderQuantity: 2 }, options).lines.line
      .requestedQuantityExplanation,
  ).toBe('stock-events.required');
  expect(validate({ requestedQuantity: 0, calculatedOrderQuantity: 2 }, options).lines).toEqual({});
});
it('accepts a positive adjustment and ignores adjustments outside the non-full column subset', () => {
  expect(
    validate({ stockAdjustments: [{ reasonId: 'credit', quantity: 2 }], stockOnHand: 12 }).lines,
  ).toEqual({});
  expect(
    validate(
      { beginningBalance: null, stockAdjustments: [{ reasonId: 'credit', quantity: 0 }] },
      { fullSupply: false },
    ).lines,
  ).toEqual({});
});

it('refuses invalid optional numeric draft text even when calculations normalize it to null', () => {
  const req = record({
    template: {
      columnsMap: {
        requestedQuantity: column('requestedQuantity', 0, {
          source: 'USER_INPUT',
          columnDefinition: { columnType: 'NUMERIC' },
        }),
        calculatedOrderQuantity: column('calculatedOrderQuantity', 1),
      },
    },
    requisitionLineItems: [line({ requestedQuantity: null })],
  });
  const result = validateRequisition(
    req,
    buildLines(req, [product()]),
    { monthsInPeriod: 1 },
    { line: { requestedQuantity: 'abc' } },
  );
  expect(result.lines.line.requestedQuantity).toBe('stock-events.positive-number');
});

it('validates only approval columns while retaining numeric draft errors', () => {
  const req = record({
    status: 'AUTHORIZED',
    template: {
      columnsMap: {
        beginningBalance: column('beginningBalance', 0, { source: 'USER_INPUT' }),
        approvedQuantity: column('approvedQuantity', 1, {
          source: 'USER_INPUT',
          columnDefinition: { columnType: 'NUMERIC' },
        }),
      },
    },
    requisitionLineItems: [line({ beginningBalance: null, approvedQuantity: 2 })],
  });
  const options = { monthsInPeriod: 1, columns: ['approvedQuantity', 'remarks'] };
  expect(validateRequisition(req, buildLines(req, [product()]), options).lines).toEqual({});
  expect(
    validateRequisition(req, buildLines(req, [product()]), options, {
      line: { approvedQuantity: '-' },
    }).lines.line,
  ).toEqual({ approvedQuantity: 'stock-events.positive-number' });
});
