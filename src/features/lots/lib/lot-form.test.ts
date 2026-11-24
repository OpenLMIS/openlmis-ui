import { describe, expect, it } from 'vitest';
import { lotFormSchema, toLotBody, toLotFormValues } from '@/features/lots/lib/lot-form';
import type { Lot } from '@/features/lots/lib/types';

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
  it('reports the Lots page messages for the lot code rules', () => {
    expect(issues({ lotCode: '  ' })).toContain('lots.form.code-required');
    expect(issues({ lotCode: 'A'.repeat(21) })).toEqual(['lots.form.code-too-long']);
    expect(issues({ lotCode: 'LC 2017' })).toEqual(['lots.form.code-invalid']);
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
