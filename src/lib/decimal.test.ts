import { describe, expect, it } from 'vitest';
import { decimalText, toDecimal } from '@/lib/decimal';

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

  it('refuses anything but a plain number, without rewriting what was typed', () => {
    for (const value of ['-1', '+3', '1e3', 'abc', '1,5', '1.', '.5', '1.2.3', '1 000']) {
      expect(message(schema, value)).toEqual(['error.title']);
    }
  });

  it('refuses a number above the maximum', () => {
    const capped = decimalText(messages, { max: 100 });
    expect(message(capped, '100')).toBeUndefined();
    expect(message(capped, '100.01')).toEqual(['error.check-connection']);
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
