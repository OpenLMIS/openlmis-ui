import type { ParseKeys } from 'i18next';
import { describe, expect, it } from 'vitest';
import { lotCodeSchema } from '@/lib/lot-code';

const messages = {
  required: 'required' as ParseKeys,
  tooLong: 'too-long' as ParseKeys,
  invalid: 'invalid' as ParseKeys,
};

const issues = (code: string) => {
  const result = lotCodeSchema(messages).safeParse(code);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('lotCodeSchema', () => {
  it('takes a code of the characters lot codes allow', () => {
    expect(issues(`AB-12/3.x_(1)*+,:;<=>?!"%&'`.slice(0, 20))).toEqual([]);
  });

  it('asks for a code', () => {
    expect(issues('  ')).toContain('required');
  });

  it('refuses a code longer than 20 characters', () => {
    expect(issues('A'.repeat(20))).toEqual([]);
    expect(issues('A'.repeat(21))).toEqual(['too-long']);
  });

  it('refuses characters a lot code cannot hold', () => {
    expect(issues('LC 2017')).toEqual(['invalid']);
    expect(issues('LÓT1')).toEqual(['invalid']);
  });
});
