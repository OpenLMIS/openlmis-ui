import { describe, expect, it } from 'vitest';
import { quantityValue } from '@/components/form/quantity-value';
import { applyScanCount } from '@/features/stock-events/lib/apply-scan';
import { eventLinesSchema, newEventLine } from '@/features/stock-events/lib/event-form';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { eventProductOptions } from '@/features/stock-events/lib/products';
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
  ...newEventLine(card, undefined, today, { kind: 'adjustment', productHasLots: true }),
  reasonId: 'lost',
  reasonFreeText: 'Broken',
  occurredDate: '2026-09-01',
  quantity: quantityValue('25', 20),
};

describe('applyScanCount', () => {
  it('counts the first scan and prepends a new line with the manual Add defaults', () => {
    const result = applyScanCount(
      [draft],
      { type: 'add', card },
      { kind: 'adjustment', today, productHasLots: true },
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      orderable: card.orderable,
      lot: card.lot,
      quantity: quantityValue('20', 20),
      reasonId: 'lost',
      reasonFreeText: 'Broken',
      occurredDate: '2026-09-01',
    });
    expect(result[0].key).not.toBe(draft.key);
    expect(result[1]).toBe(draft);
    expect(
      applyScanCount(
        [],
        { type: 'add', card },
        { kind: 'adjustment', today, productHasLots: true },
      )[0],
    ).toMatchObject({
      reasonId: '',
      occurredDate: today,
      quantity: quantityValue('20', 20),
    });
  });
  it('adds one pack in doses while preserving a partial-pack remainder and row metadata', () => {
    const result = applyScanCount(
      [draft],
      { type: 'count', lineKey: draft.key },
      { kind: 'adjustment', today, productHasLots: true },
    );
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
    const result = applyScanCount(lines, resolution, {
      kind: 'adjustment',
      today,
      productHasLots: true,
    });
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
      lines = applyScanCount(lines, decision, { kind: 'adjustment', today, productHasLots: true });
    }
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity.doses).toBe('40');
  });
  it.each([undefined, null, 0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    'counts one dose for invalid pack size %s',
    (netContent) => {
      const fallback = { ...card, orderable: { ...card.orderable, netContent } };
      const added = applyScanCount(
        [],
        { type: 'add', card: fallback },
        { kind: 'adjustment', today, productHasLots: true },
      );
      expect(added[0].quantity).toEqual(quantityValue('1', netContent));
      expect(
        applyScanCount(
          added,
          { type: 'count', lineKey: added[0].key },
          { kind: 'adjustment', today, productHasLots: true },
        )[0].quantity.doses,
      ).toBe('2');
    },
  );
  it('starts empty or invalid quantities at one pack and reads localized whole numbers', () => {
    for (const doses of ['', '1.5']) {
      expect(
        applyScanCount(
          [{ ...draft, quantity: quantityValue(doses, 20) }],
          { type: 'count', lineKey: draft.key },
          { kind: 'adjustment', today, productHasLots: true },
        )[0].quantity.doses,
      ).toBe('20');
    }
    expect(
      applyScanCount(
        [{ ...draft, quantity: quantityValue('۲۵', 20) }],
        { type: 'count', lineKey: draft.key },
        { kind: 'adjustment', today, productHasLots: true },
      )[0].quantity.doses,
    ).toBe('45');
  });
  it('leaves refused, unconfirmed and stale decisions unchanged', () => {
    const lines = [draft];
    expect(
      applyScanCount(
        lines,
        { type: 'refuse', reason: 'lotRequired', params: {} },
        { kind: 'adjustment', today, productHasLots: true },
      ),
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
        { kind: 'adjustment', today, productHasLots: true },
      ),
    ).toEqual(lines);
    expect(
      applyScanCount(
        lines,
        { type: 'count', lineKey: 'gone' },
        { kind: 'adjustment', today, productHasLots: true },
      ),
    ).toEqual(lines);
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
    const schema = eventLinesSchema({ kind: 'adjustment', reasons, today });
    const counted = applyScanCount(
      [draft],
      { type: 'count', lineKey: draft.key },
      { kind: 'adjustment', today, productHasLots: true },
    );
    expect(schema.safeParse({ lines: counted }).error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['lines', 0, 'quantity', 'doses'],
        message: 'stock-events.quantity-greater-than-stock-on-hand',
      }),
    );
    const huge = { ...draft, quantity: quantityValue('2147483647', 20) };
    const overflow = applyScanCount(
      [huge],
      { type: 'count', lineKey: huge.key },
      { kind: 'adjustment', today, productHasLots: true },
    );
    expect(overflow[0].quantity.doses).toBe('2147483667');
    expect(schema.safeParse({ lines: overflow }).error?.issues).toContainEqual(
      expect.objectContaining({ message: 'stock-events.number-too-large' }),
    );
  });
});

it('copies issue destination and falls back to today and a listed reason on scanned additions', () => {
  const reasons = [
    {
      id: 'transfer',
      name: 'Transfer',
      reasonType: 'DEBIT',
      reasonCategory: 'TRANSFER',
      isFreeTextAllowed: true,
      tags: [],
    },
  ];
  const result = applyScanCount(
    [],
    { type: 'add', card },
    {
      kind: 'issue',
      today,
      productHasLots: true,
      reasons,
      defaultReasonId: 'transfer',
      assignments: [
        {
          id: 'assignment',
          programId: 'p1',
          facilityTypeId: 'ft1',
          name: 'Organization',
          geoLevelAffinityId: null,
          node: { id: 'node', referenceId: 'org1', refDataFacility: false },
          isFreeTextAllowed: true,
        },
      ],
      previousLine: {
        ...draft,
        occurredDate: '',
        reasonId: '',
        counterparty: 'assignment',
        counterpartyComments: 'Deliver',
      },
    },
  );
  expect(result[0]).toMatchObject({
    occurredDate: today,
    reasonId: 'transfer',
    counterparty: 'assignment',
    counterpartyComments: 'Deliver',
  });
});

it.each([
  { stockOnHand: 0, expirationDate: '2027-01-01' },
  { stockOnHand: 1, expirationDate: '2026-10-06' },
])('refuses an Issue scan of unavailable stock %s', ({ stockOnHand, expirationDate }) => {
  const unavailable = { ...card, stockOnHand, lot: { id: 'lot', lotCode: 'LOT', expirationDate } };
  const available = {
    ...card,
    lot: { id: 'other', lotCode: 'OTHER', expirationDate: '2027-01-01' },
  };
  const products = eventProductOptions(
    EVENT_KINDS.issue.products.cardFilter([unavailable, available], today),
  );
  const resolution = resolveScan({
    scan,
    tradeItemId: 't1',
    products,
    lines: [],
    policy: { allowsNewLot: false },
  });
  expect(resolution).toMatchObject({ type: 'refuse', reason: 'lotNotOnScreen' });
  expect(applyScanCount([], resolution, { kind: 'issue', today, productHasLots: true })).toEqual(
    [],
  );
});

it('adds a scanned new lot or stockless Receive entry with the manual Add defaults', () => {
  const stockless = { orderable: card.orderable, lot: null, stockOnHand: null };
  const policy = { allowsNewLot: true, today } as const;
  const previousLine = {
    ...draft,
    reasonId: '',
    counterparty: 'source',
    counterpartyComments: '',
  };
  const lines = [previousLine];
  const options = { kind: 'receive', today, productHasLots: false, previousLine } as const;
  const newLot = resolveScan({
    scan: { gtin: scan.gtin, lotCode: 'NEW', expiry: '2027-03-31' },
    tradeItemId: 't1',
    products: [{ orderable: card.orderable, cards: [stockless] }],
    lines,
    policy,
  });
  expect(applyScanCount(lines, newLot, options)[0]).toMatchObject({
    orderable: card.orderable,
    lot: { lotCode: 'NEW', expirationDate: '2027-03-31', tradeItemId: 't1' },
    stockOnHand: 0,
    counterparty: 'source',
    occurredDate: '2026-09-01',
    quantity: quantityValue('20', 20),
  });
  const noLot = resolveScan({
    scan: { gtin: scan.gtin },
    tradeItemId: 't1',
    products: [{ orderable: card.orderable, cards: [stockless] }],
    lines,
    policy,
  });
  expect(applyScanCount(lines, noLot, options)[0]).toMatchObject({ lot: null, stockOnHand: null });
});
