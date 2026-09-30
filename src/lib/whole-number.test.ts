import { describe, expect, it } from 'vitest';
import { wholeNumberText } from '@/lib/whole-number';

const schema = wholeNumberText({
  required: 'error.try-again',
  invalid: 'error.title',
  tooLarge: 'error.check-connection',
});

const message = (value: string) => schema.safeParse(value).error?.issues.map((i) => i.message);

describe('wholeNumberText', () => {
  it('reads a whole number, ignoring spaces around it', () => {
    expect(schema.parse(' 12 ')).toBe(12);
    expect(schema.parse('0')).toBe(0);
    expect(schema.parse('007')).toBe(7);
    expect(schema.parse('2147483647')).toBe(2147483647);
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
    expect(message('99999999999999999999')).toEqual(['error.check-connection']);
  });
});
