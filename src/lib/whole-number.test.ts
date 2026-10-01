import { describe, expect, it } from 'vitest';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

const schema = wholeNumberText({
  required: 'error.try-again',
  invalid: 'error.title',
  tooLarge: 'error.check-connection',
});

const message = (value: string) => schema.safeParse(value).error?.issues.map((i) => i.message);

describe('wholeNumberText', () => {
  it('accepts a whole number, ignoring spaces around it', () => {
    for (const value of [' 12 ', '0', '007', '2147483647']) {
      expect(message(value)).toBeUndefined();
    }
  });

  it('accepts the digits an Arabic or Persian keyboard types', () => {
    expect(message('١٢')).toBeUndefined();
    expect(message('۱۲')).toBeUndefined();
  });

  it('asks for a value when there is none', () => {
    expect(message('')).toEqual(['error.try-again']);
    expect(message('  ')).toEqual(['error.try-again']);
  });

  it('refuses anything but digits, without rewriting what was typed', () => {
    for (const value of ['1.5', '-1', '+3', '1e3', 'abc', '1 000']) {
      expect(message(value)).toEqual(['error.title']);
    }
  });

  it('refuses a number the server cannot store', () => {
    expect(message('2147483648')).toEqual(['error.check-connection']);
    expect(message('٢١٤٧٤٨٣٦٤٨')).toEqual(['error.check-connection']);
  });
});

describe('wholeNumberText with a range', () => {
  const ranged = wholeNumberText(
    { required: 'error.try-again', invalid: 'error.title', tooLarge: 'error.check-connection' },
    { min: { value: 1, tooSmall: 'error.description' }, max: Number.MAX_SAFE_INTEGER },
  );
  const rangedMessage = (value: string) =>
    ranged.safeParse(value).error?.issues.map((i) => i.message);

  it('refuses a number below the minimum', () => {
    expect(rangedMessage('0')).toEqual(['error.description']);
    expect(rangedMessage('1')).toBeUndefined();
  });

  it('takes a maximum above what a Java int holds', () => {
    expect(rangedMessage('2147483648')).toBeUndefined();
    expect(rangedMessage('9007199254740991')).toBeUndefined();
    expect(rangedMessage('9007199254740992')).toEqual(['error.check-connection']);
  });
});

describe('toWholeNumber', () => {
  it('reads the number, in any of those digits', () => {
    expect(toWholeNumber(' 7 ')).toBe(7);
    expect(toWholeNumber('١٢')).toBe(12);
    expect(toWholeNumber('۱۲')).toBe(12);
  });
});
