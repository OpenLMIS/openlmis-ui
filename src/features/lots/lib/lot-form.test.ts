import { describe, expect, it } from 'vitest';
import {
  isDuplicateLotCode,
  lotFormSchema,
  toLotBody,
  toLotFormValues,
} from '@/features/lots/lib/lot-form';
import type { Lot } from '@/features/lots/lib/types';
import { httpError } from '@/tests/http-error';

const lot: Lot = {
  id: 'l1',
  lotCode: 'LC2017A',
  active: true,
  tradeItemId: 't1',
  expirationDate: '2019-01-30',
  manufactureDate: null,
};

const issues = (values: Partial<ReturnType<typeof toLotFormValues>>, refused: string[] = []) => {
  const result = lotFormSchema(refused).safeParse({ ...toLotFormValues(lot), ...values });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('lotFormSchema', () => {
  it('takes a code of the characters lot codes allow', () => {
    expect(issues({ lotCode: `AB-12/3.x_(1)*+,:;<=>?!"%&'`.slice(0, 20) })).toEqual([]);
  });

  it('asks for a code', () => {
    expect(issues({ lotCode: '  ' })).toContain('lots.form.code-required');
  });

  it('refuses a code longer than 20 characters', () => {
    expect(issues({ lotCode: 'A'.repeat(20) })).toEqual([]);
    expect(issues({ lotCode: 'A'.repeat(21) })).toEqual(['lots.form.code-too-long']);
  });

  it('refuses characters a lot code cannot hold', () => {
    expect(issues({ lotCode: 'LC 2017' })).toEqual(['lots.form.code-invalid']);
    expect(issues({ lotCode: 'LÓT1' })).toEqual(['lots.form.code-invalid']);
  });

  it('refuses a code the server said another lot of the product has, whatever its case', () => {
    expect(issues({ lotCode: 'lc2018b' }, ['LC2018B'])).toEqual(['lots.form.code-taken']);
  });

  it('leaves both dates optional', () => {
    expect(issues({ expirationDate: '', manufactureDate: '' })).toEqual([]);
  });
});

describe('toLotFormValues', () => {
  it('fills the form with the saved lot, a missing date as empty', () => {
    expect(toLotFormValues(lot)).toEqual({
      lotCode: 'LC2017A',
      expirationDate: '2019-01-30',
      manufactureDate: '',
    });
  });
});

describe('toLotBody', () => {
  it('sends the saved lot back with the changes, an empty date as none', () => {
    expect(
      toLotBody({ lotCode: 'LC2017B', expirationDate: '', manufactureDate: '2017-02-01' }, lot),
    ).toEqual({
      ...lot,
      lotCode: 'LC2017B',
      expirationDate: null,
      manufactureDate: '2017-02-01',
    });
  });
});

describe('isDuplicateLotCode', () => {
  const refusal = (messageKey: string) => httpError(400, { messageKey });

  it('spots the server refusing a code another lot of the product has', () => {
    expect(isDuplicateLotCode(refusal('referenceData.error.lot.lotCode.mustBeUnique'))).toBe(true);
  });

  it('ignores any other failure', () => {
    expect(isDuplicateLotCode(refusal('referenceData.error.lot.lotCode.tooLong'))).toBe(false);
    expect(isDuplicateLotCode(new Error('offline'))).toBe(false);
  });
});
