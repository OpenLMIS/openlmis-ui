import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { FacilityTypeBody } from '@/features/facility-types/lib/types';
import type { FacilityType } from '@/features/reference-data/lib/types';
import { wholeNumberText } from '@/lib/whole-number';

const errorKey = (key: ParseKeys) => key;

const same = (a: string | null, b: string) => a?.trim().toLowerCase() === b.trim().toLowerCase();

export type TakenFacilityType = Pick<FacilityType, 'id' | 'code' | 'name'>;

export function facilityTypeFormSchema(types: readonly TakenFacilityType[], editingId?: string) {
  const others = types.filter((type) => type.id !== editingId);
  return z.object({
    code: z
      .string()
      .trim()
      .min(1, errorKey('facility-types.form.code-required'))
      .refine(
        (code) => !others.some((type) => same(type.code, code)),
        errorKey('facility-types.form.code-taken'),
      ),
    name: z
      .string()
      .trim()
      .min(1, errorKey('facility-types.form.name-required'))
      .refine(
        (name) => !others.some((type) => same(type.name, name)),
        errorKey('facility-types.form.name-taken'),
      ),
    displayOrder: wholeNumberText({
      required: errorKey('facility-types.form.display-order-required'),
      invalid: errorKey('facility-types.form.display-order-whole'),
      tooLarge: errorKey('facility-types.form.display-order-too-large'),
    }),
    active: z.boolean(),
    primaryHealthCare: z.boolean(),
  });
}

export type FacilityTypeFormValues = z.input<ReturnType<typeof facilityTypeFormSchema>>;

export const EMPTY_FACILITY_TYPE_FORM: FacilityTypeFormValues = {
  code: '',
  name: '',
  displayOrder: '1',
  active: true,
  primaryHealthCare: false,
};

export function toFacilityTypeFormValues(type: FacilityType): FacilityTypeFormValues {
  return {
    code: type.code,
    name: type.name ?? '',
    displayOrder: type.displayOrder === null ? '' : String(type.displayOrder),
    active: type.active,
    primaryHealthCare: type.primaryHealthCare,
  };
}

export function toFacilityTypeBody(
  values: FacilityTypeFormValues,
  saved?: FacilityType,
): FacilityTypeBody {
  return {
    ...saved,
    code: values.code.trim(),
    name: values.name.trim(),
    displayOrder: Number(values.displayOrder.trim()),
    active: values.active,
    primaryHealthCare: values.primaryHealthCare,
  };
}

const DUPLICATE_KEYS: Record<string, 'code' | 'name'> = {
  'referenceData.error.facilityType.code.duplicated': 'code',
  'referenceData.error.facilityType.name.duplicated': 'name',
};

export function duplicateField(error: unknown) {
  if (!isAxiosError<{ messageKey?: string }>(error)) return undefined;
  const key = error.response?.data?.messageKey;
  return key ? DUPLICATE_KEYS[key] : undefined;
}
