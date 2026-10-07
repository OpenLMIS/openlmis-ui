import { describe, expect, it } from 'vitest';
import { cardQuantity, fromDoses, productQuantity, toDoses } from '@/lib/quantity';

describe('cardQuantity', () => {
  it('formats doses and both pack quantities in the requested language', () => {
    expect(cardQuantity(1234, 5, 'DOSES', 'fr')).toBe('1\u202f234');
    expect(cardQuantity(1234, 5, 'DOSES', 'ar-EG')).toBe('١٬٢٣٤');
    expect(cardQuantity(14, 5, 'PACKS', 'ar-EG')).toBe('٢ ( +٤ )');
    expect(cardQuantity(-11, 10, 'PACKS', 'fr')).toBe('-1 ( -1 )');
    expect(cardQuantity(2, null, 'PACKS', 'ar-EG')).toBe('٠');
    expect(cardQuantity(null, 5, 'DOSES', 'fr')).toBeNull();
  });

  it('normalizes negative zero packs before localizing', () => {
    expect(cardQuantity(-3, 10, 'PACKS', 'en')).toBe('0 ( -3 )');
    expect(cardQuantity(-3, 10, 'PACKS', 'fr')).toBe('0 ( -3 )');
    expect(cardQuantity(-10, 10, 'PACKS', 'en')).toBe('-1 ( +0 )');
  });

  it('shows doses as they are', () => {
    expect(cardQuantity(150, 16, 'DOSES')).toBe('150');
    expect(cardQuantity(-3, 16, 'DOSES')).toBe('-3');
  });

  it('shows packs with the doses left over, as legacy does', () => {
    expect(cardQuantity(150, 16, 'PACKS')).toBe('9 ( +6 )');
    expect(cardQuantity(40, 16, 'PACKS')).toBe('2 ( +8 )');
    expect(cardQuantity(10, 10, 'PACKS')).toBe('1 ( +0 )');
    expect(cardQuantity(0, 10, 'PACKS')).toBe('0 ( +0 )');
  });

  it('rounds a negative balance toward zero with a negative remainder', () => {
    expect(cardQuantity(-11, 10, 'PACKS')).toBe('-1 ( -1 )');
    expect(cardQuantity(-5, 10, 'PACKS')).toBe('0 ( -5 )');
  });

  it('shows no packs without a pack size, as legacy does', () => {
    expect(cardQuantity(150, 0, 'PACKS')).toBe('0');
    expect(cardQuantity(150, null, 'PACKS')).toBe('0');
    expect(cardQuantity(150, undefined, 'PACKS')).toBe('0');
  });

  it('has nothing to show without a balance', () => {
    expect(cardQuantity(null, 10, 'DOSES')).toBeNull();
    expect(cardQuantity(null, 10, 'PACKS')).toBeNull();
  });
});

describe('productQuantity', () => {
  it('shows the product total in doses, even when inactive cards are hidden', () => {
    expect(productQuantity(170, [90], 10, 'DOSES')).toBe('170');
  });

  it('sums the cards shown into packs, leaving out a zero remainder', () => {
    expect(productQuantity(170, [90, 80], 10, 'PACKS')).toBe('17');
    expect(productQuantity(170, [90], 16, 'PACKS')).toBe('5 ( +10 )');
  });

  it('keeps legacy floor rounding for a negative total', () => {
    expect(productQuantity(-11, [-11], 10, 'PACKS')).toBe('-2 ( +-1 )');
  });

  it('formats the numbers in the language given, as the card does', () => {
    expect(productQuantity(2549, [2549], 10, 'DOSES', 'en')).toBe('2,549');
    expect(productQuantity(25_495, [25_495], 10, 'PACKS', 'en')).toBe('2,549 ( +5 )');
  });

  it('shows no packs without a pack size', () => {
    expect(productQuantity(170, [170], null, 'PACKS')).toBe('0');
  });

  it('has nothing to show in packs while a card shown has no balance', () => {
    expect(productQuantity(null, [null, undefined], 10, 'PACKS')).toBeNull();
    expect(productQuantity(90, [90, null], 10, 'PACKS')).toBeNull();
  });

  it('has nothing to show in doses without a total', () => {
    expect(productQuantity(null, [], 10, 'DOSES')).toBeNull();
  });
});

describe('quantity entry conversion', () => {
  it('combines whole packs and remaining doses and splits them back', () => {
    expect(toDoses({ packs: 3, remainder: 2 }, 16)).toBe(50);
    expect(fromDoses(50, 16)).toEqual({ packs: 3, remainder: 2 });
    expect(fromDoses(48, 16)).toEqual({ packs: 3, remainder: 0 });
    expect(fromDoses(0, 16)).toEqual({ packs: 0, remainder: 0 });
  });

  it('allows a remainder larger than the pack size without losing doses', () => {
    expect(fromDoses(toDoses({ packs: 1, remainder: 18 }, 16), 16)).toEqual({
      packs: 2,
      remainder: 2,
    });
  });

  it.each([0, null, undefined])('returns zero without a pack size (%s), as legacy does', (size) => {
    expect(toDoses({ packs: 3, remainder: 2 }, size)).toBe(0);
    expect(fromDoses(50, size)).toEqual({ packs: 0, remainder: 0 });
  });
});
