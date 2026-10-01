import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  addProgramSchema,
  availablePrograms,
  EMPTY_FACILITY_FORM,
  type FacilityFormValues,
  facilityFormSchema,
  isDuplicateCode,
  tabWithFirstError,
  toFacilityBody,
  toProgramRow,
} from '@/features/facilities/lib/facility-form';
import type { Program } from '@/features/reference-data/lib/types';

const program = (id: string, code: string, name: string | null): Program => ({
  id,
  code,
  name,
  active: true,
});

const familyPlanning = program('p1', 'PRG001', 'Family Planning');
const essentialMeds = program('p2', 'PRG002', 'Essential Meds');

const filled: FacilityFormValues = {
  ...EMPTY_FACILITY_FORM,
  name: ' Comfort Health Clinic ',
  code: ' HC01 ',
  typeId: 't1',
  zoneId: 'z1',
};

const issues = (values: FacilityFormValues, refused: string[] = []) => {
  const result = facilityFormSchema(refused).safeParse(values);
  return result.success
    ? []
    : result.error.issues.map(({ path, message }) => [path.join('.'), message]);
};

describe('facilityFormSchema', () => {
  it('asks for a name, code, type and zone, counting whitespace alone as empty', () => {
    expect(issues({ ...EMPTY_FACILITY_FORM, name: '  ', code: ' ' })).toEqual([
      ['name', 'facilities.form.name-required'],
      ['code', 'facilities.form.code-required'],
      ['typeId', 'facilities.form.type-required'],
      ['zoneId', 'facilities.form.zone-required'],
    ]);
    expect(issues(filled)).toEqual([]);
  });

  it('leaves the operational date, description and operator optional, as legacy does on add', () => {
    expect(issues({ ...filled, goLiveDate: '', description: '', operatorId: null })).toEqual([]);
  });

  it('refuses a code the server refused, ignoring case and surrounding spaces', () => {
    expect(issues({ ...filled, code: ' hc01' }, ['HC01'])).toEqual([
      ['code', 'facilities.form.code-taken'],
    ]);
  });

  it('asks for a start date on every program', () => {
    const row = { ...toProgramRow(familyPlanning, '2026-10-01'), supportStartDate: '' };
    expect(issues({ ...filled, programs: [row] })).toEqual([
      ['programs.0.supportStartDate', 'facilities.form.start-date-required'],
    ]);
  });
});

describe('toFacilityBody', () => {
  it('trims the text, sends references by id and every flag', () => {
    expect(
      toFacilityBody({
        ...filled,
        description: '  ',
        operatorId: 'o1',
        goLiveDate: '2026-09-15',
        active: false,
        programs: [toProgramRow(familyPlanning, '2026-10-01')],
      }),
    ).toEqual({
      code: 'HC01',
      name: 'Comfort Health Clinic',
      description: null,
      active: false,
      enabled: true,
      goLiveDate: '2026-09-15',
      type: { id: 't1' },
      geographicZone: { id: 'z1' },
      operator: { id: 'o1' },
      supportedPrograms: [
        {
          id: 'p1',
          code: 'PRG001',
          supportActive: true,
          supportLocallyFulfilled: false,
          supportStartDate: '2026-10-01',
        },
      ],
    });
  });

  it('sends no operational date or operator when none is picked', () => {
    const body = toFacilityBody(filled);
    expect(body.goLiveDate).toBeNull();
    expect(body.operator).toBeNull();
    expect(body.supportedPrograms).toEqual([]);
  });
});

describe('program rows', () => {
  it('start active, not locally fulfilled, from the picked date, as legacy adds them', () => {
    expect(toProgramRow(familyPlanning, '2026-10-01')).toEqual({
      id: 'p1',
      code: 'PRG001',
      name: 'Family Planning',
      supportActive: true,
      supportLocallyFulfilled: false,
      supportStartDate: '2026-10-01',
      saved: false,
    });
  });

  it('offers only the programs not added yet, by name', () => {
    const third = program('p3', 'PRG003', null);
    expect(
      availablePrograms(
        [familyPlanning, third, essentialMeds],
        [toProgramRow(familyPlanning, '2026-10-01')],
      ),
    ).toEqual([essentialMeds, third]);
  });
});

describe('tabWithFirstError', () => {
  it('opens Information when any of its fields is wrong, else Programs', () => {
    expect(tabWithFirstError(['programs[0].supportStartDate', 'code'])).toBe('information');
    expect(tabWithFirstError(['programs[0].supportStartDate'])).toBe('programs');
    expect(tabWithFirstError([])).toBeUndefined();
  });
});

describe('isDuplicateCode', () => {
  it('recognises the server refusing a code in use', () => {
    const refusal = (messageKey: string) =>
      new AxiosError('Bad Request', '400', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { messageKey },
      });
    expect(isDuplicateCode(refusal('referenceData.error.facility.code.mustBeUnique'))).toBe(true);
    expect(isDuplicateCode(refusal('referenceData.error.facility.code.required'))).toBe(false);
    expect(isDuplicateCode(new Error('offline'))).toBe(false);
  });
});

describe('addProgramSchema', () => {
  it('asks for a program and a start date before a row is added', () => {
    const result = addProgramSchema.safeParse({ programId: null, startDate: '' });
    expect(
      result.success ? [] : result.error.issues.map(({ path, message }) => [path[0], message]),
    ).toEqual([
      ['programId', 'facilities.form.program-required'],
      ['startDate', 'facilities.form.start-date-required'],
    ]);
    expect(addProgramSchema.safeParse({ programId: 'p1', startDate: '2026-10-01' }).success).toBe(
      true,
    );
  });
});
