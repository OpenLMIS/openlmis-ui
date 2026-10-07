import { describe, expect, it } from 'vitest';
import { quantityValue, updateQuantityValue } from '@/components/form/quantity-value';

describe('quantity value', () => {
  it('keeps both representations ready without changing the draft on a unit switch', () => {
    const value = quantityValue('50', 16);
    expect(value).toEqual({ doses: '50', packs: '3', remainder: '2' });
    expect(updateQuantityValue(value, 'packs', '4', 16)).toEqual({
      doses: '66',
      packs: '4',
      remainder: '2',
    });
  });

  it('keeps cleared inputs empty and accepts a remaining dose entry by itself', () => {
    const value = quantityValue('', 16);
    expect(value).toEqual({ doses: '', packs: '', remainder: '' });
    expect(updateQuantityValue(value, 'remainder', '2', 16)).toEqual({
      doses: '2',
      packs: '',
      remainder: '2',
    });
    expect(updateQuantityValue(quantityValue('16', 16), 'packs', '', 16)).toEqual({
      doses: '0',
      packs: '',
      remainder: '0',
    });
  });

  it.each(['1.5', '-1', 'no', '9007199254740992'])('preserves invalid doses (%s)', (text) => {
    const value = quantityValue(text, 16);
    expect(value.doses).toBe(text);
    expect(value.packs).toBe(text);
    expect(value.remainder).toBe('');
  });

  it('retains both raw pack inputs while the doses text stays invalid for schema validation', () => {
    const value = updateQuantityValue(quantityValue('50', 16), 'remainder', '1.5', 16);
    expect(value).toEqual({ doses: '3 * 16 + 1.5', packs: '3', remainder: '1.5' });
    expect(updateQuantityValue(value, 'remainder', '2', 16)).toEqual({
      doses: '50',
      packs: '3',
      remainder: '2',
    });
  });

  it('does not normalize raw packs or remainders while typing', () => {
    expect(updateQuantityValue(quantityValue('', 16), 'packs', '003', 16)).toEqual({
      doses: '48',
      packs: '003',
      remainder: '',
    });
    expect(updateQuantityValue(quantityValue('16', 16), 'remainder', '18', 16)).toEqual({
      doses: '34',
      packs: '1',
      remainder: '18',
    });
  });

  it('accepts Arabic and Persian digits for conversion without changing their raw text', () => {
    expect(quantityValue('٥٠', 16)).toEqual({ doses: '٥٠', packs: '3', remainder: '2' });
    expect(updateQuantityValue(quantityValue('', 16), 'packs', '۳', 16)).toEqual({
      doses: '48',
      packs: '۳',
      remainder: '',
    });
  });

  it.each([0, null, undefined])(
    'uses one for a missing pack size (%s) to preserve an editable value',
    (size) => {
      expect(quantityValue('7', size)).toEqual({ doses: '7', packs: '7', remainder: '0' });
    },
  );
});
