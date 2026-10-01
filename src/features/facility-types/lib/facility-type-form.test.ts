import { describe, expect, it } from 'vitest';
import {
  duplicateField,
  EMPTY_FACILITY_TYPE_FORM,
  type FacilityTypeFormValues,
  facilityTypeFormSchema,
  toFacilityTypeBody,
  toFacilityTypeFormValues,
} from '@/features/facility-types/lib/facility-type-form';
import type { FacilityType } from '@/features/reference-data/lib/types';
import { httpError } from '@/tests/http-error';

const healthCenter: FacilityType = {
  id: 'ft3',
  code: 'health_center',
  name: 'Health Center',
  description: 'Kept as it is',
  displayOrder: 3,
  active: true,
  primaryHealthCare: true,
};

const warehouse: FacilityType = {
  id: 'ft1',
  code: 'warehouse',
  name: 'Warehouse',
  description: null,
  displayOrder: 1,
  active: false,
  primaryHealthCare: false,
};

const types = [healthCenter, warehouse];

const valid: FacilityTypeFormValues = {
  ...EMPTY_FACILITY_TYPE_FORM,
  code: 'dist_store',
  name: 'District Store',
};

const messages = (values: FacilityTypeFormValues, editingId?: string) =>
  facilityTypeFormSchema(types, editingId)
    .safeParse(values)
    .error?.issues.map((issue) => [issue.path[0], issue.message]);

describe('facilityTypeFormSchema', () => {
  it('starts a new type at display order 1, active, not primary health care', () => {
    expect(EMPTY_FACILITY_TYPE_FORM).toEqual({
      code: '',
      name: '',
      displayOrder: '1',
      active: true,
      primaryHealthCare: false,
    });
  });

  it('requires a code, a name and a display order, counting spaces alone as empty', () => {
    expect(
      messages({ ...EMPTY_FACILITY_TYPE_FORM, code: ' ', name: '  ', displayOrder: '' }),
    ).toEqual([
      ['code', 'facility-types.form.code-required'],
      ['name', 'facility-types.form.name-required'],
      ['displayOrder', 'facility-types.form.display-order-required'],
    ]);
  });

  it('takes a whole display order the server can store', () => {
    expect(messages({ ...valid, displayOrder: '0' })).toBeUndefined();
    expect(messages({ ...valid, displayOrder: '1.5' })).toEqual([
      ['displayOrder', 'facility-types.form.display-order-whole'],
    ]);
    expect(messages({ ...valid, displayOrder: '2147483648' })).toEqual([
      ['displayOrder', 'facility-types.form.display-order-too-large'],
    ]);
  });

  it('refuses a code or a name another type has, ignoring case and spaces, active or not', () => {
    expect(messages({ ...valid, code: ' Health_Center ', name: 'warehouse ' })).toEqual([
      ['code', 'facility-types.form.code-taken'],
      ['name', 'facility-types.form.name-taken'],
    ]);
  });

  it('lets a type keep its own code and name', () => {
    expect(messages(toFacilityTypeFormValues(healthCenter), 'ft3')).toBeUndefined();
  });
});

describe('toFacilityTypeFormValues', () => {
  it('fills the form from a saved type', () => {
    expect(toFacilityTypeFormValues(healthCenter)).toEqual({
      code: 'health_center',
      name: 'Health Center',
      displayOrder: '3',
      active: true,
      primaryHealthCare: true,
    });
  });

  it('shows a type saved without an active flag as inactive, so it can be saved as it is', () => {
    const values = toFacilityTypeFormValues({
      ...warehouse,
      active: null,
      primaryHealthCare: null,
    });

    expect(values).toMatchObject({ active: false, primaryHealthCare: false });
    expect(facilityTypeFormSchema(types, 'ft1').safeParse(values).success).toBe(true);
  });

  it('shows a missing name or display order as empty', () => {
    expect(
      toFacilityTypeFormValues({ ...warehouse, name: null, displayOrder: null }),
    ).toMatchObject({ name: '', displayOrder: '' });
  });
});

describe('toFacilityTypeBody', () => {
  it('sends a new type trimmed, with the display order as a number', () => {
    expect(
      toFacilityTypeBody({
        ...valid,
        code: ' dist_store ',
        name: ' District Store ',
        displayOrder: ' 7 ',
      }),
    ).toEqual({
      code: 'dist_store',
      name: 'District Store',
      displayOrder: 7,
      active: true,
      primaryHealthCare: false,
    });
  });

  it('sends a saved type whole, so the server keeps what the form does not show', () => {
    expect(
      toFacilityTypeBody(
        { ...toFacilityTypeFormValues(healthCenter), name: 'Clinic', active: false },
        healthCenter,
      ),
    ).toEqual({ ...healthCenter, name: 'Clinic', active: false });
  });
});

describe('toFacilityTypeBody with a saved type', () => {
  it('sends the locked code exactly as it is stored', () => {
    const spaced = { ...healthCenter, code: ' spaced ' };
    expect(toFacilityTypeBody(toFacilityTypeFormValues(spaced), spaced).code).toBe(' spaced ');
  });

  it('reads a display order typed in Arabic digits', () => {
    expect(toFacilityTypeBody({ ...valid, displayOrder: '١٢' }).displayOrder).toBe(12);
  });
});

describe('duplicateField', () => {
  const refusal = (messageKey: string) => {
    const error = httpError(400);
    Object.assign(error.response ?? {}, { data: { messageKey, message: 'In use' } });
    return error;
  };

  it('names the field the server found in use', () => {
    expect(duplicateField(refusal('referenceData.error.facilityType.code.duplicated'))).toBe(
      'code',
    );
    expect(duplicateField(refusal('referenceData.error.facilityType.name.duplicated'))).toBe(
      'name',
    );
  });

  it('names none for any other failure', () => {
    expect(
      duplicateField(refusal('referenceData.error.facilityType.saving.with.id')),
    ).toBeUndefined();
    expect(duplicateField(new Error('offline'))).toBeUndefined();
  });
});
