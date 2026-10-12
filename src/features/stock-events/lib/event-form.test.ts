import { describe, expect, expectTypeOf, it } from 'vitest';
import { quantityValue, updateQuantityValue } from '@/components/form/quantity-value';
import type { Reason } from '@/features/reference-data/lib/types';
import {
  changeEventCounterparty,
  changeEventLot,
  changeEventReason,
  type EventLine,
  eventLinesSchema,
  eventPayload,
  newEventLine,
} from '@/features/stock-events/lib/event-form';
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
const schema = eventLinesSchema({ kind: 'adjustment', reasons, today });
const line = (patch: Partial<EventLine> = {}): EventLine => ({
  ...newEventLine(card, undefined, today, { kind: 'adjustment', productHasLots: true }),
  reasonId: 'damage',
  quantity: quantityValue('1', 16),
  ...patch,
});
const issues = (lines: EventLine[]) =>
  schema.safeParse({ lines }).error?.issues.map(({ path, message }) => [path.join('.'), message]);

describe('newEventLine', () => {
  it('creates independent stable keys and captures card metadata with empty inputs', () => {
    const first = newEventLine(card, undefined, today, {
      kind: 'adjustment',
      productHasLots: true,
    });
    const second = newEventLine(card, undefined, today, {
      kind: 'adjustment',
      productHasLots: true,
    });
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
  it('copies only date, reason and comments from the previous line, falling back to today for an empty date', () => {
    const previous = line({
      occurredDate: '',
      reasonId: 'lost',
      reasonFreeText: 'Broken',
      vvmStatus: 'STAGE_2',
    });
    const next = newEventLine(
      { ...card, lot: null, orderable: { ...card.orderable, extraData: null } },
      previous,
      today,
      { kind: 'adjustment', productHasLots: true },
    );
    expect(next).toMatchObject({
      occurredDate: today,
      reasonId: 'lost',
      reasonFreeText: 'Broken',
      quantity: quantityValue(),
      lot: null,
      useVVM: false,
      vvmStatus: '',
    });
    expect(next.key).not.toBe(previous.key);
    expect(
      newEventLine(card, line({ occurredDate: '2026-09-01' }), today, {
        kind: 'adjustment',
        productHasLots: true,
      }).occurredDate,
    ).toBe('2026-09-01');
  });
});

describe('eventLinesSchema', () => {
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

describe('changeEventReason', () => {
  it('clears comments immutably when the reason changes and preserves them for the same reason', () => {
    const saved = line({ reasonId: 'lost', reasonFreeText: 'Broken' });
    expect(changeEventReason(saved, 'damage')).toEqual({
      ...saved,
      reasonId: 'damage',
      reasonFreeText: '',
    });
    expect(saved.reasonFreeText).toBe('Broken');
    expect(changeEventReason(saved, 'lost')).toEqual(saved);
  });
});

describe('eventPayload', () => {
  it('matches the legacy POST shape and sends doses without draft metadata', () => {
    const row = line({
      reasonId: 'lost',
      reasonFreeText: 'Research only',
      vvmStatus: 'STAGE_1',
      quantity: updateQuantityValue(quantityValue('0', 16), 'packs', '2', 16),
    });
    expect(
      eventPayload({
        kind: 'adjustment',
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
      eventPayload({
        kind: 'adjustment',
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

const assignments = [
  {
    id: 'assignment',
    programId: 'p1',
    facilityTypeId: 'ft1',
    name: 'Organization',
    geoLevelAffinityId: null,
    node: { id: 'node', referenceId: 'org1', refDataFacility: false },
    isFreeTextAllowed: true,
  },
  {
    id: 'facility',
    programId: 'p1',
    facilityTypeId: 'ft1',
    name: 'Facility',
    geoLevelAffinityId: null,
    node: { id: 'facility-node', referenceId: 'f1', refDataFacility: true },
    isFreeTextAllowed: false,
  },
];
describe('issue form', () => {
  const options = { kind: 'issue' as const, reasons, today, assignments };
  const issueLine = (patch: Partial<EventLine> = {}) =>
    line({ counterparty: 'assignment', reasonId: '', ...patch });
  it('requires a listed destination but permits no reason', () => {
    expect(eventLinesSchema(options).safeParse({ lines: [issueLine()] }).success).toBe(true);
    for (const counterparty of ['', 'missing']) {
      expect(
        eventLinesSchema(options).safeParse({ lines: [issueLine({ counterparty })] }).error?.issues,
      ).toContainEqual(
        expect.objectContaining({
          path: ['lines', 0, 'counterparty'],
          message: 'stock-events.required',
        }),
      );
    }
  });
  it.each(['', 'return', 'lost'])('caps every issue quantity with reason %s', (reasonId) => {
    expect(
      eventLinesSchema(options).safeParse({
        lines: [issueLine({ reasonId, quantity: quantityValue('51') })],
      }).error?.issues,
    ).toContainEqual(expect.objectContaining({ path: ['lines', 0, 'quantity', 'doses'] }));
  });
  it('checks destination comments and clears them when destination changes', () => {
    const saved = issueLine({ counterpartyComments: 'Deliver' });
    expect(changeEventCounterparty(saved, 'facility')).toEqual({
      ...saved,
      counterparty: 'facility',
      counterpartyComments: '',
    });
    expect(changeEventCounterparty(saved, 'assignment')).toBe(saved);
    expect(
      eventLinesSchema(options).safeParse({
        lines: [issueLine({ counterpartyComments: 'a'.repeat(255) })],
      }).success,
    ).toBe(true);
    for (const patch of [
      { counterpartyComments: 'a'.repeat(256) },
      { counterparty: 'facility', counterpartyComments: 'Deliver' },
    ]) {
      expect(eventLinesSchema(options).safeParse({ lines: [issueLine(patch)] }).success).toBe(
        false,
      );
    }
  });
  it('sends the destination node id and omits empty reason and comments', () => {
    const payload = eventPayload({
      ...options,
      programId: 'program',
      facilityId: 'facility',
      signature: 'Ada',
      lines: [issueLine()],
    });
    expect(payload.eventOrigin).toBe('ISSUE');
    expect(payload.lineItems[0]).toEqual({
      orderableId: card.orderable.id,
      lotId: card.lot?.id,
      quantity: 1,
      occurredDate: today,
      destinationId: 'node',
      extraData: {},
    });
    expect(
      eventPayload({
        ...options,
        programId: 'program',
        facilityId: 'facility',
        signature: '',
        lines: [issueLine({ counterpartyComments: 'Deliver' })],
      }).lineItems[0].destinationFreeText,
    ).toBe('Deliver');
  });
});

describe('default event reason', () => {
  const options = {
    kind: 'issue' as const,
    reasons,
    defaultReasonId: 'lost',
    assignments,
    productHasLots: true,
  };
  it('uses only a listed default and makes the reason required', () => {
    const previous = line({ reasonId: '', occurredDate: '' });
    expect(newEventLine(card, previous, today, options)).toMatchObject({
      reasonId: 'lost',
      occurredDate: today,
    });
    expect(
      newEventLine(card, previous, today, { ...options, defaultReasonId: 'missing' }).reasonId,
    ).toBe('');
    expect(newEventLine(card, line({ reasonId: 'damage' }), today, options).reasonId).toBe(
      'damage',
    );
    expect(
      eventLinesSchema({ ...options, today }).safeParse({
        lines: [line({ counterparty: 'assignment', reasonId: '' })],
      }).error?.issues,
    ).toContainEqual(
      expect.objectContaining({ path: ['lines', 0, 'reasonId'], message: 'stock-events.required' }),
    );
    expect(
      eventLinesSchema({ ...options, defaultReasonId: 'missing', today }).safeParse({
        lines: [line({ counterparty: 'assignment', reasonId: '' })],
      }).success,
    ).toBe(true);
  });
});

describe('receive form', () => {
  const receiveReasons = [reason('transfer-in', 'CREDIT', true)];
  const options = { kind: 'receive' as const, reasons: receiveReasons, today, assignments };
  const receiveLine = (patch: Partial<EventLine> = {}) =>
    line({ counterparty: 'assignment', reasonId: '', ...patch });
  const parse = (lines: EventLine[], patch: { defaultReasonId?: string } = {}) =>
    eventLinesSchema({ ...options, ...patch }).safeParse({ lines });
  const newLot = { lotCode: 'NEW-1', expirationDate: '2027-01-31', tradeItemId: 'trade-1' };
  it('requires a listed source and never caps the quantity by stock on hand', () => {
    expect(
      parse([
        receiveLine({ quantity: quantityValue('51') }),
        receiveLine({ stockOnHand: null, quantity: quantityValue('9') }),
      ]).success,
    ).toBe(true);
    for (const counterparty of ['', 'missing']) {
      expect(parse([receiveLine({ counterparty })]).error?.issues).toEqual([
        expect.objectContaining({
          path: ['lines', 0, 'counterparty'],
          message: 'stock-events.required',
        }),
      ]);
    }
  });
  it('allows source comments only for a free-text source, up to 255 characters', () => {
    expect(parse([receiveLine({ counterpartyComments: 'a'.repeat(255) })]).success).toBe(true);
    expect(parse([receiveLine({ counterpartyComments: 'a'.repeat(256) })]).success).toBe(false);
    expect(
      parse([receiveLine({ counterparty: 'facility', counterpartyComments: 'NGO' })]).error?.issues,
    ).toEqual([
      expect.objectContaining({
        path: ['lines', 0, 'counterpartyComments'],
        message: 'stock-events.comments-not-allowed',
      }),
    ]);
  });
  it('keeps the reason optional unless the default is listed, then preselects and requires it', () => {
    const fresh = (defaultReasonId?: string) =>
      newEventLine(card, undefined, today, { ...options, defaultReasonId, productHasLots: true });
    expect(fresh().reasonId).toBe('');
    expect(fresh('missing').reasonId).toBe('');
    expect(fresh('transfer-in').reasonId).toBe('transfer-in');
    expect(parse([receiveLine()], { defaultReasonId: 'missing' }).success).toBe(true);
    expect(parse([receiveLine()], { defaultReasonId: 'transfer-in' }).error?.issues).toEqual([
      expect.objectContaining({ path: ['lines', 0, 'reasonId'], message: 'stock-events.required' }),
    ]);
  });
  it('copies the source, its allowed comments, reason and date from the previous line', () => {
    const previous = receiveLine({
      counterpartyComments: 'From NGO',
      reasonId: 'transfer-in',
      reasonFreeText: 'Donation',
      occurredDate: '2026-10-01',
    });
    expect(newEventLine(card, previous, today, { ...options, productHasLots: true })).toMatchObject(
      {
        counterparty: 'assignment',
        counterpartyComments: 'From NGO',
        reasonId: 'transfer-in',
        reasonFreeText: 'Donation',
        occurredDate: '2026-10-01',
      },
    );
    expect(
      newEventLine(card, { ...previous, counterparty: 'facility' }, today, {
        ...options,
        productHasLots: true,
      }),
    ).toMatchObject({ counterparty: 'facility', counterpartyComments: '' });
  });
  it('sends the source node id, existing lot ids and new lots inline without empty fields', () => {
    const payload = eventPayload({
      ...options,
      programId: 'program',
      facilityId: 'facility',
      signature: 'Ada',
      lines: [
        receiveLine({ counterpartyComments: 'From NGO', reasonId: 'transfer-in' }),
        receiveLine({ lot: newLot, counterpartyComments: '  ' }),
        receiveLine({ lot: { ...newLot, expirationDate: null } }),
        receiveLine({ lot: null }),
      ],
    });
    expect(payload.eventOrigin).toBe('RECEIVE');
    expect(payload.lineItems).toEqual([
      {
        orderableId: 'product-1',
        lotId: 'lot-1',
        quantity: 1,
        occurredDate: today,
        sourceId: 'node',
        sourceFreeText: 'From NGO',
        reasonId: 'transfer-in',
        extraData: {},
      },
      {
        orderableId: 'product-1',
        lot: { lotCode: 'NEW-1', expirationDate: '2027-01-31' },
        quantity: 1,
        occurredDate: today,
        sourceId: 'node',
        extraData: {},
      },
      {
        orderableId: 'product-1',
        lot: { lotCode: 'NEW-1' },
        quantity: 1,
        occurredDate: today,
        sourceId: 'node',
        extraData: {},
      },
      {
        orderableId: 'product-1',
        lotId: null,
        quantity: 1,
        occurredDate: today,
        sourceId: 'node',
        extraData: {},
      },
    ]);
    expect(payload.lineItems[1]).not.toHaveProperty('lotId');
    expect(payload.lineItems[0]).not.toHaveProperty('destinationId');
  });
});

describe('changeEventLot', () => {
  const lot = (lotCode: string, expirationDate: string | null, tradeItemId = 'trade-1') => ({
    lotCode,
    expirationDate,
    tradeItemId,
  });
  const lines = [
    line({ key: 'a', lot: lot('NEW-1', '2027-01-31') }),
    line({ key: 'b', lot: lot('NEW-1', '2027-01-31', 'trade-2') }),
    line({ key: 'c', lot: lot('NEW-1', '2027-06-30') }),
    line({ key: 'd', lot: lot('NEW-2', '2027-01-31') }),
    line({ key: 'e' }),
  ];
  const lotsOf = (next: EventLine[]) => next.map((item) => item.lot);
  it('applies a changed code and expiry to that line only', () => {
    const next = changeEventLot(lines, 'a', { lotCode: 'NEW-9', expirationDate: '2028-01-01' });
    expect(lotsOf(next)).toEqual([lot('NEW-9', '2028-01-01'), ...lotsOf(lines).slice(1)]);
  });
  it('applies a changed expiry alone to every new lot with the same code and old expiry', () => {
    const next = changeEventLot(lines, 'a', { lotCode: 'NEW-1', expirationDate: null });
    expect(lotsOf(next)).toEqual([
      lot('NEW-1', null),
      lot('NEW-1', null, 'trade-2'),
      ...lotsOf(lines).slice(2),
    ]);
    expect(lines[0].lot).toEqual(lot('NEW-1', '2027-01-31'));
  });
  it('matches the edited code in any letter case', () => {
    const cased = [
      line({ key: 'a', lot: lot('abc', null) }),
      line({ key: 'b', lot: lot('ABC', null) }),
    ];
    expect(
      lotsOf(changeEventLot(cased, 'a', { lotCode: 'abc', expirationDate: '2028-01-01' })),
    ).toEqual([lot('abc', '2028-01-01'), lot('ABC', '2028-01-01')]);
    expect(
      lotsOf(changeEventLot(cased, 'a', { lotCode: 'Abc', expirationDate: '2028-01-01' })),
    ).toEqual([lot('Abc', '2028-01-01'), lot('ABC', null)]);
  });
  it('leaves lines with an existing lot unchanged', () => {
    expect(changeEventLot(lines, 'e', { lotCode: 'X', expirationDate: null })).toEqual(lines);
  });
});

it('requires an explicit event kind for every form operation', () => {
  type Kind = { kind: 'adjustment' | 'issue' | 'receive' | 'unpack' };
  expectTypeOf<Parameters<typeof newEventLine>[3]>().toExtend<Kind>();
  expectTypeOf<Parameters<typeof eventLinesSchema>[0]>().toExtend<Kind>();
  expectTypeOf<Parameters<typeof eventPayload>[0]>().toExtend<Kind>();
});

describe('unpack form', () => {
  const options = { kind: 'unpack' as const, reasons: [], today };
  const children = [
    { orderable: { id: 'child-a' }, quantity: 2 },
    { orderable: { id: 'child-b' }, quantity: 5 },
  ];
  const kitLine = (patch: Partial<EventLine> = {}) =>
    line({
      reasonId: '',
      orderable: { ...card.orderable, children },
      ...patch,
    });
  const unpackIssues = (lines: EventLine[]) =>
    eventLinesSchema(options)
      .safeParse({ lines })
      .error?.issues.map(({ path, message }) => [path.join('.'), message]);

  it('builds debit kit lines first then no-lot credits from each line in doses, without origin or signature', () => {
    const first = kitLine({
      quantity: updateQuantityValue(quantityValue('', 16), 'packs', '2', 16),
      occurredDate: '2026-10-06',
      vvmStatus: 'STAGE_2',
    });
    const second = kitLine({ quantity: quantityValue('3'), lot: null });
    expect(
      eventPayload({
        kind: 'unpack',
        programId: 'program',
        facilityId: 'facility',
        signature: 'Ada',
        kitReasons: { debit: 'unpack', credit: 'contents' },
        lines: [first, second],
      }),
    ).toEqual({
      programId: 'program',
      facilityId: 'facility',
      lineItems: [
        {
          orderableId: 'product-1',
          lotId: 'lot-1',
          quantity: 32,
          occurredDate: '2026-10-06',
          reasonId: 'unpack',
          extraData: { vvmStatus: 'STAGE_2' },
        },
        {
          orderableId: 'product-1',
          lotId: null,
          quantity: 3,
          occurredDate: today,
          reasonId: 'unpack',
          extraData: {},
        },
        {
          orderableId: 'child-a',
          lotId: null,
          quantity: 64,
          occurredDate: '2026-10-06',
          reasonId: 'contents',
          extraData: {},
        },
        {
          orderableId: 'child-b',
          lotId: null,
          quantity: 160,
          occurredDate: '2026-10-06',
          reasonId: 'contents',
          extraData: {},
        },
        {
          orderableId: 'child-a',
          lotId: null,
          quantity: 6,
          occurredDate: today,
          reasonId: 'contents',
          extraData: {},
        },
        {
          orderableId: 'child-b',
          lotId: null,
          quantity: 15,
          occurredDate: today,
          reasonId: 'contents',
          extraData: {},
        },
      ],
    });
  });
  it('refuses to build an unpack payload without its configured reasons', () => {
    expect(() =>
      eventPayload({
        kind: 'unpack',
        programId: 'program',
        facilityId: 'facility',
        lines: [kitLine()],
      }),
    ).toThrow('Kit unpack reasons are required');
  });
  it('caps every unpack line independently, allowing equal SOH', () => {
    expect(
      unpackIssues([
        kitLine({ quantity: quantityValue('50') }),
        kitLine({ quantity: quantityValue('50') }),
      ]),
    ).toBeUndefined();
    expect(unpackIssues([kitLine(), kitLine({ quantity: quantityValue('51') })])).toEqual([
      ['lines.1.quantity.doses', 'stock-events.quantity-greater-than-stock-on-hand'],
    ]);
    expect(unpackIssues([kitLine({ stockOnHand: -1 })])).toEqual([
      ['lines.0.quantity.doses', 'stock-events.quantity-greater-than-stock-on-hand'],
    ]);
  });
  it('accepts a content quantity at the int maximum and rejects one more on quantity', () => {
    const withCount = (quantity: number) =>
      kitLine({
        orderable: { ...card.orderable, children: [{ orderable: { id: 'child' }, quantity }] },
        quantity: quantityValue('2'),
      });
    expect(
      unpackIssues([
        kitLine({
          stockOnHand: 2_147_483_647,
          quantity: quantityValue('2147483647'),
          orderable: { ...card.orderable, children: [{ orderable: { id: 'child' }, quantity: 1 }] },
        }),
      ]),
    ).toBeUndefined();
    expect(unpackIssues([withCount(1_073_741_823)])).toBeUndefined();
    expect(unpackIssues([withCount(1_073_741_824)])).toEqual([
      ['lines.0.quantity.doses', 'stock-unpack.contents-too-large'],
    ]);
  });
  it('refuses an invalid content count on quantity', () => {
    expect(
      unpackIssues([
        kitLine({
          orderable: {
            ...card.orderable,
            children: [{ orderable: { id: 'child' }, quantity: null }],
          },
        }),
      ]),
    ).toEqual([['lines.0.quantity.doses', 'stock-unpack.contents-invalid']]);
  });
  it('does not flag other lines for a line already over the content limit', () => {
    const over = kitLine({
      quantity: quantityValue('1073741824'),
      stockOnHand: 2_147_483_647,
      orderable: { ...card.orderable, children: [{ orderable: { id: 'x' }, quantity: 2 }] },
    });
    const small = kitLine({
      quantity: quantityValue('1'),
      orderable: { ...card.orderable, children: [{ orderable: { id: 'x' }, quantity: 1 }] },
    });
    expect(unpackIssues([over, small])).toEqual([
      ['lines.0.quantity.doses', 'stock-unpack.contents-too-large'],
    ]);
  });
  it.each([undefined, []])('refuses a product with no kit contents %s on quantity', (children) => {
    expect(unpackIssues([kitLine({ orderable: { ...card.orderable, children } })])).toEqual([
      ['lines.0.quantity.doses', 'stock-unpack.not-a-kit'],
    ]);
  });
  it('allows zero contents and flags every positive contributor to an overflowing shared product total', () => {
    const shared = [{ orderable: { id: 'shared' }, quantity: 1_073_741_823 }];
    const first = kitLine({ orderable: { ...card.orderable, children: shared } });
    const second = kitLine({ orderable: { ...card.orderable, id: 'other-kit', children: shared } });
    const zero = kitLine({
      orderable: { ...card.orderable, children: [{ orderable: { id: 'shared' }, quantity: 0 }] },
    });
    expect(unpackIssues([first, second, zero])).toBeUndefined();
    expect(
      unpackIssues([
        first,
        second,
        kitLine({
          quantity: quantityValue('2'),
          orderable: {
            ...card.orderable,
            children: [{ orderable: { id: 'shared' }, quantity: 1 }],
          },
        }),
        zero,
        kitLine(),
      ]),
    ).toEqual([
      ['lines.0.quantity.doses', 'stock-unpack.contents-too-large'],
      ['lines.1.quantity.doses', 'stock-unpack.contents-too-large'],
      ['lines.2.quantity.doses', 'stock-unpack.contents-too-large'],
    ]);
  });
  it('does not count invalid raw quantities toward other lines content totals', () => {
    const shared = [{ orderable: { id: 'shared' }, quantity: 1_073_741_823 }];
    const valid = kitLine({ orderable: { ...card.orderable, children: shared } });
    const invalid = kitLine({
      quantity: quantityValue('1.5'),
      orderable: { ...card.orderable, children: shared },
    });
    expect(unpackIssues([valid, invalid])).toEqual([
      ['lines.1.quantity.doses', 'stock-events.positive-number'],
    ]);
  });
});
