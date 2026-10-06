import { describe, expect, it } from 'vitest';
import { cardQuantity, productQuantity } from '@/lib/quantity';

describe('cardQuantity', () => {
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

  it('shows no packs without a pack size', () => {
    expect(productQuantity(170, [170], null, 'PACKS')).toBe('0');
  });

  it('has nothing to show in doses without a total', () => {
    expect(productQuantity(null, [], 10, 'DOSES')).toBeNull();
  });
});
