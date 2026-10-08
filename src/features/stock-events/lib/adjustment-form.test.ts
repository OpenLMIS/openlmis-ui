import { describe, expect, it } from 'vitest';
import { quantityValue, updateQuantityValue } from '@/components/form/quantity-value';
import type { Reason } from '@/features/reference-data/lib/types';
import {
  type AdjustmentLine,
  adjustmentLinesSchema,
  adjustmentPayload,
  changeAdjustmentReason,
  newAdjustmentLine,
} from '@/features/stock-events/lib/adjustment-form';
import type { EventStockCard } from '@/features/stock-events/lib/types';

const today = '2026-10-07';
const card: EventStockCard = {
  id: 'card-1',
  stockOnHand: 50,
  orderable: {
    id: 'product-1',
    productCode: 'C1',
    fullProductName: 'Aspirin',
    netContent: 16,
    identifiers: { tradeItem: 'trade-1' },
    extraData: { useVVM: 'true' },
  },
  lot: { id: 'lot-1', lotCode: 'LC2017A', expirationDate: '2019-01-30' },
};
const reason = (id: string, reasonType: string, isFreeTextAllowed = false): Reason => ({
  id,
  name: id,
  reasonType,
  isFreeTextAllowed,
  reasonCategory: 'ADJUSTMENT',
  tags: [],
});
const reasons = [
  reason('damage', 'DEBIT'),
  reason('lost', 'DEBIT', true),
  reason('return', 'CREDIT'),
];
const schema = adjustmentLinesSchema({ reasons, today });
const line = (patch: Partial<AdjustmentLine> = {}): AdjustmentLine => ({
  ...newAdjustmentLine(card, undefined, today),
  reasonId: 'damage',
  quantity: quantityValue('1', 16),
  ...patch,
});
const issues = (lines: AdjustmentLine[]) =>
  schema.safeParse({ lines }).error?.issues.map(({ path, message }) => [path.join('.'), message]);

describe('newAdjustmentLine', () => {
  it('creates independent stable keys and captures card metadata with empty inputs', () => {
    const first = newAdjustmentLine(card, undefined, today);
    const second = newAdjustmentLine(card, undefined, today);
    expect(first.key).not.toBe(second.key);
    expect(first).not.toHaveProperty('card');
    expect(first).toMatchObject({
      orderable: card.orderable,
      lot: card.lot,
      stockOnHand: 50,
      netContent: 16,
      useVVM: true,
      reasonId: '',
      reasonFreeText: '',
      quantity: quantityValue(),
      occurredDate: today,
      vvmStatus: '',
    });
  });
  it('copies only date, reason and comments from the previous line, including an empty date', () => {
    const previous = line({
      occurredDate: '',
      reasonId: 'lost',
      reasonFreeText: 'Broken',
      vvmStatus: 'STAGE_2',
    });
    const next = newAdjustmentLine(
      { ...card, lot: null, orderable: { ...card.orderable, extraData: null } },
      previous,
      today,
    );
    expect(next).toMatchObject({
      occurredDate: '',
      reasonId: 'lost',
      reasonFreeText: 'Broken',
      quantity: quantityValue(),
      lot: null,
      useVVM: false,
      vvmStatus: '',
    });
    expect(next.key).not.toBe(previous.key);
    expect(newAdjustmentLine(card, line({ occurredDate: '2026-09-01' }), today).occurredDate).toBe(
      '2026-09-01',
    );
  });
});

describe('adjustmentLinesSchema', () => {
  it.each([
    ['', 'stock-events.required'],
    ['0', 'stock-events.positive-number'],
    ['-1', 'stock-events.positive-number'],
    ['1.5', 'stock-events.positive-number'],
    ['2147483648', 'stock-events.number-too-large'],
    ['٣', undefined],
    ['۳', undefined],
    ['1', undefined],
    ['50', undefined],
    ['51', 'stock-events.quantity-greater-than-stock-on-hand'],
  ])('preserves quantity validation paths and messages for %s', (doses, message) => {
    expect(issues([line({ quantity: quantityValue(doses) })])).toEqual(
      message ? [['lines.0.quantity.doses', message]] : undefined,
    );
  });

  it('places required issues on the individual cells of every row', () => {
    const empty = line({ reasonId: '', quantity: quantityValue(), occurredDate: '' });
    expect(issues([line(), empty])).toEqual([
      ['lines.1.reasonId', 'stock-events.required'],
      ['lines.1.quantity.doses', 'stock-events.required'],
      ['lines.1.occurredDate', 'stock-events.required'],
    ]);
  });
  it.each(['0', '-1', '1.5', '1e2', 'NaN', 'Infinity', '1,000'])(
    'refuses invalid positive quantities: %s',
    (doses) => {
      expect(issues([line({ quantity: quantityValue(doses, 16) })])).toContainEqual([
        'lines.0.quantity.doses',
        'stock-events.positive-number',
      ]);
    },
  );
  it('accepts the int maximum, Arabic/Persian digits, and rejects greater values', () => {
    expect(
      issues([line({ reasonId: 'return', quantity: quantityValue('2147483647') })]),
    ).toBeUndefined();
    expect(
      issues([line({ quantity: quantityValue(' ٣ ') }), line({ quantity: quantityValue('۳') })]),
    ).toBeUndefined();
    expect(issues([line({ quantity: quantityValue('2147483648') })])).toContainEqual([
      'lines.0.quantity.doses',
      'stock-events.number-too-large',
    ]);
  });
  it('refuses invalid raw packs and compares converted doses with SOH', () => {
    const quantity = updateQuantityValue(quantityValue('50', 16), 'packs', '1.5', 16);
    expect(issues([line({ quantity })])).toContainEqual([
      'lines.0.quantity.doses',
      'stock-events.positive-number',
    ]);
    expect(
      issues([line({ quantity: updateQuantityValue(quantityValue('50', 16), 'packs', '4', 16) })]),
    ).toEqual([['lines.0.quantity.doses', 'stock-events.quantity-greater-than-stock-on-hand']]);
  });
  it('checks debit balances per line, allows equal SOH, and allows credit above SOH', () => {
    expect(
      issues([line({ quantity: quantityValue('50') }), line({ quantity: quantityValue('50') })]),
    ).toBeUndefined();
    expect(
      issues([
        line({ quantity: quantityValue('51') }),
        line({ reasonId: 'return', quantity: quantityValue('51') }),
      ]),
    ).toEqual([['lines.0.quantity.doses', 'stock-events.quantity-greater-than-stock-on-hand']]);
    expect(issues([line({ stockOnHand: 0 })])).toEqual([
      ['lines.0.quantity.doses', 'stock-events.quantity-greater-than-stock-on-hand'],
    ]);
  });
  it('refuses an unknown reason', () => {
    expect(issues([line({ reasonId: 'not-valid-here' })])).toContainEqual([
      'lines.0.reasonId',
      'stock-events.required',
    ]);
  });
  it('accepts today and past dates, refuses future and invalid calendar dates', () => {
    expect(issues([line(), line({ occurredDate: '2019-01-01' })])).toBeUndefined();
    expect(issues([line({ occurredDate: '2026-10-08' })])).toEqual([
      ['lines.0.occurredDate', 'stock-events.date-future'],
    ]);
    expect(issues([line({ occurredDate: '2026-02-30' })])).toEqual([
      ['lines.0.occurredDate', 'stock-events.date-invalid'],
    ]);
  });
  it('allows optional comments only for a free-text reason, up to 255 characters', () => {
    expect(issues([line({ reasonId: 'lost', reasonFreeText: 'a'.repeat(255) })])).toBeUndefined();
    expect(issues([line({ reasonId: 'lost', reasonFreeText: 'a'.repeat(256) })])).toEqual([
      ['lines.0.reasonFreeText', 'stock-events.comments-too-long'],
    ]);
    expect(issues([line({ reasonFreeText: 'broken' })])).toEqual([
      ['lines.0.reasonFreeText', 'stock-events.comments-not-allowed'],
    ]);
  });
  it('allows optional VVM Stage 1 and 2 only for VVM products, rejecting other stages', () => {
    expect(
      issues([
        line(),
        line({ vvmStatus: 'STAGE_1' }),
        line({ vvmStatus: 'STAGE_2' }),
        line({ useVVM: false }),
      ]),
    ).toBeUndefined();
    expect(issues([line({ useVVM: false, vvmStatus: 'STAGE_1' })])).toEqual([
      ['lines.0.vvmStatus', 'stock-events.vvm-not-allowed'],
    ]);
    const invalid = { ...line(), vvmStatus: 'STAGE_3' };
    expect(schema.safeParse({ lines: [invalid] }).error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['lines', 0, 'vvmStatus'],
        message: 'stock-events.vvm-invalid',
      }),
    );
  });
});

describe('changeAdjustmentReason', () => {
  it('clears comments immutably when the reason changes and preserves them for the same reason', () => {
    const saved = line({ reasonId: 'lost', reasonFreeText: 'Broken' });
    expect(changeAdjustmentReason(saved, 'damage')).toEqual({
      ...saved,
      reasonId: 'damage',
      reasonFreeText: '',
    });
    expect(saved.reasonFreeText).toBe('Broken');
    expect(changeAdjustmentReason(saved, 'lost')).toEqual(saved);
  });
});

describe('adjustmentPayload', () => {
  it('matches the legacy POST shape and sends doses without draft metadata', () => {
    const row = line({
      reasonId: 'lost',
      reasonFreeText: 'Research only',
      vvmStatus: 'STAGE_1',
      quantity: updateQuantityValue(quantityValue('0', 16), 'packs', '2', 16),
    });
    expect(
      adjustmentPayload({
        programId: 'program',
        facilityId: 'facility',
        signature: '',
        lines: [row],
      }),
    ).toEqual({
      programId: 'program',
      facilityId: 'facility',
      signature: '',
      eventOrigin: 'ADJUSTMENT',
      lineItems: [
        {
          orderableId: 'product-1',
          lotId: 'lot-1',
          reasonId: 'lost',
          reasonFreeText: 'Research only',
          quantity: 32,
          occurredDate: today,
          extraData: { vvmStatus: 'STAGE_1' },
        },
      ],
    });
  });
  it('sends null lot for no-lot cards, drops empty comments, and keeps empty legacy extraData', () => {
    const row = line({ lot: null, reasonFreeText: '   ', quantity: quantityValue(' ٣ ') });
    expect(
      adjustmentPayload({
        programId: 'program',
        facilityId: 'facility',
        signature: 'Jane',
        lines: [row],
      }).lineItems,
    ).toEqual([
      {
        orderableId: 'product-1',
        lotId: null,
        reasonId: 'damage',
        quantity: 3,
        occurredDate: today,
        extraData: {},
      },
    ]);
  });
});
