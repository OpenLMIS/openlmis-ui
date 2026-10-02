import { describe, expect, it } from 'vitest';
import { decimalMark, decimalText, toDecimal, toNumberText } from '@/lib/decimal';

const messages = {
  required: 'error.try-again',
  invalid: 'error.title',
  tooLarge: 'error.check-connection',
  tooPrecise: 'error.description',
} as const;

const message = (schema: ReturnType<typeof decimalText>, value: string) =>
  schema.safeParse(value).error?.issues.map((i) => i.message);

describe('decimalText', () => {
  const schema = decimalText(messages);

  it('accepts a number with or without decimals, ignoring spaces around it', () => {
    for (const value of [' 12 ', '0', '20.77', '0.5', '3.14159']) {
      expect(message(schema, value)).toBeUndefined();
    }
  });

  it('accepts the digits and decimal mark an Arabic keyboard types', () => {
    expect(message(schema, '٢٠٫٧٧')).toBeUndefined();
    expect(toDecimal('٢٠٫٧٧')).toBe(20.77);
  });

  it('asks for a value when there is none', () => {
    expect(message(schema, ' ')).toEqual(['error.try-again']);
  });

  it('refuses a comma before exactly three digits, which could be a thousands separator', () => {
    expect(message(schema, '1,000')).toEqual(['error.title']);
    expect(message(schema, '2,500')).toEqual(['error.title']);
    expect(message(schema, '2,5')).toBeUndefined();
    expect(message(schema, '1,2345')).toBeUndefined();
  });

  it('takes a decimal comma, as Portuguese writes it', () => {
    expect(message(schema, '21,50')).toBeUndefined();
    expect(toDecimal('21,50')).toBe(21.5);
  });

  it('refuses anything but a plain number, without rewriting what was typed', () => {
    for (const value of [
      '-1',
      '+3',
      '1e3',
      'abc',
      '1,5,0',
      '1.',
      '.5',
      '1.2.3',
      '1 000',
      '1.000,5',
    ]) {
      expect(message(schema, value)).toEqual(['error.title']);
    }
  });

  it('refuses a number too large to keep exactly', () => {
    expect(message(schema, '9007199254740991')).toBeUndefined();
    expect(message(schema, '9007199254740992')).toEqual(['error.check-connection']);
  });
});

describe('decimalText with a limit on decimals', () => {
  const money = decimalText(messages, { maxDecimals: 2 });

  it('takes up to that many decimals', () => {
    expect(message(money, '20.7')).toBeUndefined();
    expect(message(money, '20.77')).toBeUndefined();
    expect(message(money, '20.777')).toEqual(['error.description']);
  });
});

describe('decimalText when optional', () => {
  const optional = decimalText(
    { invalid: 'error.title', tooLarge: 'error.check-connection' },
    { optional: true },
  );

  it('accepts no value, and checks one that is there', () => {
    expect(message(optional, '')).toBeUndefined();
    expect(message(optional, 'x')).toEqual(['error.title']);
  });

  it('reads no value as none', () => {
    expect(toDecimal('  ')).toBeNull();
    expect(toDecimal(' 1.50 ')).toBe(1.5);
  });
});

describe('toNumberText', () => {
  it('shows a number as text, and none as an empty field', () => {
    expect(toNumberText(1.5)).toBe('1.5');
    expect(toNumberText(0)).toBe('0');
    expect(toNumberText(null)).toBe('');
    expect(toNumberText(undefined)).toBe('');
  });
});

describe('decimalMark', () => {
  it('is the mark the language writes decimals with', () => {
    expect(decimalMark('en')).toBe('.');
    expect(decimalMark('pt')).toBe(',');
  });
});

describe('toNumberText with a decimal mark', () => {
  it('writes the decimals with the given mark, and a whole number as it is', () => {
    expect(toNumberText(20.77, ',')).toBe('20,77');
    expect(toNumberText(3, ',')).toBe('3');
    expect(toNumberText(null, ',')).toBe('');
  });
});
