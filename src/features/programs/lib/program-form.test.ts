import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROGRAM_FORM,
  isDuplicateCode,
  type ProgramFormValues,
  programFormSchema,
  toProgramBody,
  toProgramFormValues,
} from '@/features/programs/lib/program-form';
import type { Program } from '@/features/reference-data/lib/types';
import { httpError } from '@/tests/http-error';

const arv: Program = {
  id: 'p5',
  code: 'PRG005',
  name: 'ARV',
  description: 'Antiretrovirals',
  active: true,
  periodsSkippable: true,
  skipAuthorization: false,
  showNonFullSupplyTab: true,
  enableDatePhysicalStockCountCompleted: false,
};

const takenCodes = ['PRG005', 'PRG001'];

const valid: ProgramFormValues = { ...EMPTY_PROGRAM_FORM, code: 'PRG009', name: 'Malaria' };

const messages = (values: ProgramFormValues, codes: readonly string[] = takenCodes) =>
  programFormSchema(codes)
    .safeParse(values)
    .error?.issues.map((issue) => [issue.path[0], issue.message]);

describe('programFormSchema', () => {
  it('starts a new program active, with every requisition setting off', () => {
    expect(EMPTY_PROGRAM_FORM).toEqual({
      code: '',
      name: '',
      description: '',
      active: true,
      showNonFullSupplyTab: false,
      periodsSkippable: false,
      skipAuthorization: false,
      enableDatePhysicalStockCountCompleted: false,
    });
  });

  it('requires a code and a name, counting spaces alone as empty', () => {
    expect(messages({ ...EMPTY_PROGRAM_FORM, code: ' ', name: '  ' })).toEqual([
      ['code', 'programs.form.code-required'],
      ['name', 'programs.form.name-required'],
    ]);
  });

  it('refuses a code another program has, ignoring spaces as the server does', () => {
    expect(messages({ ...valid, code: ' PRG 001 ' })).toEqual([
      ['code', 'programs.form.code-taken'],
    ]);
  });

  it('takes a code that differs only in case, which the server stores as a new code', () => {
    expect(messages({ ...valid, code: 'prg001' })).toBeUndefined();
  });

  it('asks for a name when a program was saved without one', () => {
    const nameless = toProgramFormValues({ ...arv, name: null });
    expect(nameless.name).toBe('');
    expect(messages(nameless, [])).toEqual([['name', 'programs.form.name-required']]);
  });
});

describe('toProgramFormValues', () => {
  it('fills the form from a saved program', () => {
    expect(toProgramFormValues(arv)).toEqual({
      code: 'PRG005',
      name: 'ARV',
      description: 'Antiretrovirals',
      active: true,
      showNonFullSupplyTab: true,
      periodsSkippable: true,
      skipAuthorization: false,
      enableDatePhysicalStockCountCompleted: false,
    });
  });

  it('shows missing settings and description as off and empty', () => {
    expect(
      toProgramFormValues({ id: 'p2', code: 'PRG002', name: 'Essential Meds', active: null }),
    ).toEqual({
      ...EMPTY_PROGRAM_FORM,
      code: 'PRG002',
      name: 'Essential Meds',
      active: false,
    });
  });
});

describe('toProgramBody', () => {
  it('sends a new program trimmed, with every setting as true or false', () => {
    expect(
      toProgramBody({ ...valid, code: ' PRG009 ', name: ' Malaria ', description: '  ' }),
    ).toEqual({
      code: 'PRG009',
      name: 'Malaria',
      description: null,
      active: true,
      showNonFullSupplyTab: false,
      periodsSkippable: false,
      skipAuthorization: false,
      enableDatePhysicalStockCountCompleted: false,
    });
  });

  it('sends a saved program whole, its code exactly as stored', () => {
    const spaced = { ...arv, code: 'PRG005 ' };
    expect(toProgramBody({ ...toProgramFormValues(spaced), name: 'ARV Program' }, spaced)).toEqual({
      ...spaced,
      name: 'ARV Program',
    });
  });
});

describe('isDuplicateCode', () => {
  const refusal = (messageKey: string) => {
    const error = httpError(400);
    Object.assign(error.response ?? {}, { data: { messageKey } });
    return error;
  };

  it('spots the server refusing a code in use', () => {
    expect(isDuplicateCode(refusal('referenceData.error.program.code.duplicated'))).toBe(true);
  });

  it('ignores any other failure', () => {
    expect(isDuplicateCode(refusal('referenceData.error.program.notFound'))).toBe(false);
    expect(isDuplicateCode(new Error('offline'))).toBe(false);
  });
});
