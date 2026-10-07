import { describe, expect, it } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import {
  adjustmentLinesSchema,
  newAdjustmentLine,
} from '@/features/stock-events/lib/adjustment-form';
import { applyScanCount } from '@/features/stock-events/lib/apply-scan';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import { resolveScan } from '@/lib/stock-scan';

const today = '2026-10-07';
const card: EventStockCard = {
  id: 'c1',
  stockOnHand: 30,
  orderable: {
    id: 'p1',
    productCode: 'P1',
    fullProductName: 'Product',
    netContent: 20,
    identifiers: { tradeItem: 't1' },
  },
  lot: { id: 'l1', lotCode: 'LOT', expirationDate: null },
};
const scan = { gtin: '00012345678905', lotCode: 'LOT', serial: 'same-pack' };
const draft = {
  ...newAdjustmentLine(card, undefined, today),
  reasonId: 'lost',
  reasonFreeText: 'Broken',
  occurredDate: '2026-09-01',
  quantity: quantityValue('25', 20),
};

describe('applyScanCount', () => {
  it('counts the first scan and prepends a new line with the manual Add defaults', () => {
    const result = applyScanCount([draft], { type: 'add', card }, { today });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      card,
      quantity: quantityValue('20', 20),
      reasonId: 'lost',
      reasonFreeText: 'Broken',
      occurredDate: '2026-09-01',
    });
    expect(result[0].key).not.toBe(draft.key);
    expect(result[1]).toBe(draft);
    expect(applyScanCount([], { type: 'add', card }, { today })[0]).toMatchObject({
      reasonId: '',
      occurredDate: today,
      quantity: quantityValue('20', 20),
    });
  });
  it('adds one pack in doses while preserving a partial-pack remainder and row metadata', () => {
    const result = applyScanCount([draft], { type: 'count', lineKey: draft.key }, { today });
    expect(result).toEqual([{ ...draft, quantity: { doses: '45', packs: '2', remainder: '5' } }]);
    expect(draft.quantity.doses).toBe('25');
  });
  it('resolves the first duplicate, leaving other lots and duplicate rows untouched', () => {
    const other = {
      ...draft,
      key: 'other',
      lot: { id: 'l2', lotCode: 'OTHER', expirationDate: null },
    };
    const duplicate = { ...draft, key: 'duplicate' };
    const lines = [other, draft, duplicate];
    const resolution = resolveScan({
      scan,
      tradeItemId: 't1',
      products: [{ orderable: card.orderable, cards: [card] }],
      lines,
      policy: { allowsNewLot: false },
    });
    expect(resolution.type).toBe('count');
    if (resolution.type !== 'count') throw new Error('Expected count');
    const result = applyScanCount(lines, resolution, { today });
    expect(result[0]).toBe(other);
    expect(result[1].quantity.doses).toBe('45');
    expect(result[2]).toBe(duplicate);
  });
  it('counts repeated serials twice in order with no duplicate line', () => {
    const products = [{ orderable: card.orderable, cards: [card] }];
    let lines: (typeof draft)[] = [];
    for (let index = 0; index < 2; index++) {
      const decision = resolveScan({
        scan,
        tradeItemId: 't1',
        products,
        lines,
        policy: { allowsNewLot: false },
      });
      if (decision.type !== 'add' && decision.type !== 'count')
        throw new Error('Expected scan action');
      lines = applyScanCount(lines, decision, { today });
    }
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity.doses).toBe('40');
  });
  it.each([undefined, null, 0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    'counts one dose for invalid pack size %s',
    (netContent) => {
      const fallback = { ...card, orderable: { ...card.orderable, netContent } };
      const added = applyScanCount([], { type: 'add', card: fallback }, { today });
      expect(added[0].quantity).toEqual(quantityValue('1', netContent));
      expect(
        applyScanCount(added, { type: 'count', lineKey: added[0].key }, { today })[0].quantity
          .doses,
      ).toBe('2');
    },
  );
  it('starts empty or invalid quantities at one pack and reads localized whole numbers', () => {
    for (const doses of ['', '1.5']) {
      expect(
        applyScanCount(
          [{ ...draft, quantity: quantityValue(doses, 20) }],
          { type: 'count', lineKey: draft.key },
          { today },
        )[0].quantity.doses,
      ).toBe('20');
    }
    expect(
      applyScanCount(
        [{ ...draft, quantity: quantityValue('۲۵', 20) }],
        { type: 'count', lineKey: draft.key },
        { today },
      )[0].quantity.doses,
    ).toBe('45');
  });
  it('leaves refused, unconfirmed and stale decisions unchanged', () => {
    const lines = [draft];
    expect(
      applyScanCount(lines, { type: 'refuse', reason: 'lotRequired', params: {} }, { today }),
    ).toEqual(lines);
    expect(
      applyScanCount(
        lines,
        {
          type: 'confirm-expiry',
          recorded: '2027-01-01',
          scanned: '2027-02-01',
          next: { type: 'count', lineKey: draft.key },
        },
        { today },
      ),
    ).toEqual(lines);
    expect(applyScanCount(lines, { type: 'count', lineKey: 'gone' }, { today })).toEqual(lines);
  });
  it('permits increments beyond SOH or int bounds so the ordinary schema marks them invalid', () => {
    const reasons = [
      {
        id: 'lost',
        name: 'Lost',
        reasonType: 'DEBIT',
        reasonCategory: 'ADJUSTMENT',
        isFreeTextAllowed: true,
        tags: [],
      },
    ];
    const schema = adjustmentLinesSchema({ reasons, today });
    const counted = applyScanCount([draft], { type: 'count', lineKey: draft.key }, { today });
    expect(schema.safeParse({ lines: counted }).error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['lines', 0, 'quantity', 'doses'],
        message: 'stock-events.quantity-greater-than-stock-on-hand',
      }),
    );
    const huge = { ...draft, quantity: quantityValue('2147483647', 20) };
    const overflow = applyScanCount([huge], { type: 'count', lineKey: huge.key }, { today });
    expect(overflow[0].quantity.doses).toBe('2147483667');
    expect(schema.safeParse({ lines: overflow }).error?.issues).toContainEqual(
      expect.objectContaining({ message: 'stock-events.number-too-large' }),
    );
  });
});
