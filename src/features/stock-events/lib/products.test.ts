import { describe, expect, it } from 'vitest';
import type { Orderable } from '@/features/reference-data/lib/types';
import {
  ADD_NEW_LOT,
  approvedProductOptions,
  eventLotOptions,
  eventProductOptions,
  issuableCards,
  kitCards,
  receiveLotOptions,
} from '@/features/stock-events/lib/products';
import type { EventStockCard } from '@/features/stock-events/lib/types';

const product = {
  id: 'o1',
  productCode: 'C1',
  fullProductName: 'Acetylsalicylic Acid',
  netContent: 16,
  dispensable: { displayUnit: '10 tab strip' },
  identifiers: { tradeItem: 't1' },
  extraData: { useVVM: 'true' },
};
const card = (id: string, lot: EventStockCard['lot'], stockOnHand = 0): EventStockCard => ({
  id,
  orderable: product,
  lot,
  stockOnHand,
});
const late = { id: 'l2', lotCode: 'LC2017B', expirationDate: '2019-08-20' };
const early = { id: 'l1', lotCode: 'LC2017A', expirationDate: '2019-01-30' };
const cards = [card('s2', late, 60), card('s0', null, 40), card('s1', early, 50)];

describe('eventProductOptions', () => {
  it('groups cards by orderable without dropping zero balances or expired lots', () => {
    const zero = {
      ...card('s3', null),
      orderable: { ...product, id: 'o2', fullProductName: null, dispensable: {} },
    };
    const options = eventProductOptions([...cards, zero]);
    expect(options).toHaveLength(2);
    expect(options[0]).toEqual({
      value: 'o1',
      label: 'Acetylsalicylic Acid - 10 tab strip',
      orderable: product,
      cards,
    });
    expect(options[1]).toMatchObject({ value: 'o2', label: 'C1', cards: [zero] });
    expect(eventProductOptions([])).toEqual([]);
  });
});

describe('eventLotOptions', () => {
  it('places the no-lot card first, sorts lots by expiry and retains expired lots', () => {
    const options = eventLotOptions(cards);
    expect(options.map((option) => option.value)).toEqual(['', 'l1', 'l2']);
    expect(options[0]).toEqual({
      value: '',
      lot: null,
      card: cards[1],
      labelKey: 'stock-events.no-lot-defined',
    });
    expect(options[1]).toEqual({ value: 'l1', lot: early, card: cards[2], label: 'LC2017A' });
    expect(cards[0]?.lot).toBe(late);
  });
  it('uses the no-lot option label even when the picker hides the lot select', () => {
    const noLot = card('s0', null);
    expect(eventLotOptions([noLot])).toEqual([
      { value: '', lot: null, card: noLot, labelKey: 'stock-events.no-lot-defined' },
    ]);
    expect(eventLotOptions([])).toEqual([]);
  });
  it('dedupes lot ids while keeping the original stock card for each option', () => {
    expect(eventLotOptions([card('s1', early), card('s2', early)])).toHaveLength(1);
  });
});

describe('issuableCards', () => {
  it('drops zero stock and expired lots, keeps negative stock, expiry today, missing expiry and no lot', () => {
    const today = '2026-10-09';
    const negative = card('negative', null, -1);
    const expiresToday = card('today', { ...early, expirationDate: today }, 1);
    const future = card('future', { ...late, expirationDate: '2026-10-10' }, 1);
    const noExpiry = card('no-expiry', { id: 'l3', lotCode: 'L3', expirationDate: null }, 1);
    const noLot = card('no-lot', null, 1);
    const input = [
      card('zero', null),
      card('expired', early, 10),
      negative,
      expiresToday,
      future,
      noExpiry,
      noLot,
    ];
    expect(issuableCards(input, today)).toEqual([negative, expiresToday, future, noExpiry, noLot]);
    expect(input).toHaveLength(7);
    expect(issuableCards([], today)).toEqual([]);
  });
});

const orderable = (id: string, fullProductName: string, tradeItem?: string): Orderable => ({
  id,
  productCode: id.toUpperCase(),
  fullProductName,
  description: null,
  dispensable: { displayUnit: 'each' },
  ...(tradeItem && { identifiers: { tradeItem } }),
});

describe('approvedProductOptions', () => {
  const approved = (item: Orderable) => ({ id: `approved-${item.id}`, orderable: item });
  const aspirin = orderable('o1', 'Aspirin');
  const bandage = orderable('o2', 'Bandage');
  const generic = orderable('f1', 'Generic Aspirin', 't1');
  const brand = orderable('f2', 'Brand Bandage', 't2');
  const fulfils = {
    o1: { canFulfillForMe: ['f1', 'missing'] },
    o2: { canFulfillForMe: ['f1', 'f2'] },
  };
  const values = (search?: string, page = [aspirin, bandage].map(approved)) =>
    approvedProductOptions(page, fulfils, [generic, brand], search).map((option) => [
      option.value,
      option.approvedId,
    ]);
  it('places each fulfilling product before the first approved product it fulfils for, once', () => {
    expect(values()).toEqual([
      ['f1', 'o1'],
      ['o1', 'o1'],
      ['f2', 'o2'],
      ['o2', 'o2'],
    ]);
    expect(approvedProductOptions([aspirin].map(approved), undefined, [generic])[0]).toEqual({
      value: 'o1',
      label: 'Aspirin - each',
      orderable: aspirin,
      approvedId: 'o1',
    });
  });
  it('lists fulfilling products matched by their own name first, even without their approved product', () => {
    expect(values('bANDage', [])).toEqual([['f2', 'o2']]);
    expect(values('aspirin', [approved(aspirin)])).toEqual([
      ['f1', 'o1'],
      ['o1', 'o1'],
    ]);
    expect(values('', [])).toEqual([]);
  });
  it('keeps an approved product that also fulfils another once, as approved', () => {
    const page = [approved(generic), approved(aspirin)];
    expect(values(undefined, page)).toEqual([
      ['f1', 'f1'],
      ['o1', 'o1'],
    ]);
  });
});

describe('receiveLotOptions', () => {
  const traded = { ...orderable('o1', 'Aspirin', 't1') };
  const expired = { id: 'l1', lotCode: 'OLD', expirationDate: '2019-01-30', tradeItemId: 't1' };
  const later = { id: 'l2', lotCode: 'NEW', expirationDate: '2030-01-30', tradeItemId: 't1' };
  const open = { id: 'l3', lotCode: 'OPEN', expirationDate: null, tradeItemId: 't1' };
  const stock = { 'o1/': 7, 'o1/l2': 0 };
  it('offers Add New Lot, No Lot Defined, then every lot by expiry with its stock on hand', () => {
    const options = receiveLotOptions({ orderable: traded }, [open, later, expired], stock, true);
    expect(options.map((option) => option.value)).toEqual([ADD_NEW_LOT, '', 'l1', 'l2', 'l3']);
    expect(options[0]).toEqual({
      value: ADD_NEW_LOT,
      lot: null,
      labelKey: 'stock-events.add-new-lot',
    });
    expect(options[1]).toEqual({
      value: '',
      lot: null,
      labelKey: 'stock-events.no-lot-defined',
      card: { orderable: traded, lot: null, stockOnHand: 7 },
    });
    expect(options.slice(2).map((option) => option.card?.stockOnHand)).toEqual([null, 0, null]);
    expect(options[2]).toMatchObject({ label: 'OLD', lot: expired });
  });
  it('offers Add New Lot only with the right and a trade item', () => {
    const first = (product: Orderable, canAddLot: boolean) =>
      receiveLotOptions({ orderable: product }, [], {}, canAddLot)[0]?.value;
    expect(first(traded, false)).toBe('');
    expect(first(orderable('o2', 'Plain'), true)).toBe('');
    expect(receiveLotOptions({ orderable: orderable('o2', 'Plain') }, [], {}, true)).toEqual([
      {
        value: '',
        lot: null,
        labelKey: 'stock-events.no-lot-defined',
        card: { orderable: orderable('o2', 'Plain'), lot: null, stockOnHand: null },
      },
    ]);
  });
});

describe('kitCards', () => {
  it('keeps only nonzero kit stock, including negative balances and expired lots', () => {
    const kit = { ...product, children: [{ orderable: { id: 'child' }, quantity: 2 }] };
    const negative = { ...card('negative', null, -1), orderable: kit };
    const expired = { ...card('expired', early, 10), orderable: kit };
    const zero = { ...card('zero', null), orderable: kit };
    const empty = { ...card('empty', null, 1), orderable: { ...kit, children: [] } };
    const input = Object.freeze([negative, expired, zero, empty, card('non-kit', null, 1)]);
    expect(kitCards(input)).toEqual([negative, expired]);
    expect(kitCards([])).toEqual([]);
  });
});
