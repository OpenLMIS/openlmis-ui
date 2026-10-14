import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { z } from 'zod';

const errorKey = (key: ParseKeys) => key;

export function addTemplateFormSchema(refusedNames: readonly string[]) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, errorKey('requisition-templates.form.name-required'))
      .max(255, errorKey('requisition-templates.form.name-too-long'))
      .refine(
        (name) => !refusedNames.includes(name),
        errorKey('requisition-templates.form.name-taken'),
      ),
    programId: z
      .string()
      .nullable()
      .refine(Boolean, errorKey('requisition-templates.form.program-required')),
    requisitionReportOnly: z.boolean(),
    facilityTypeIds: z
      .array(z.string())
      .min(1, errorKey('requisition-templates.form.facility-types-required')),
    facilityTypeId: z.string().nullable(),
  });
}

export type AddTemplateFormValues = z.infer<ReturnType<typeof addTemplateFormSchema>>;

export const EMPTY_ADD_TEMPLATE_FORM: AddTemplateFormValues = {
  name: '',
  programId: null,
  requisitionReportOnly: false,
  facilityTypeIds: [],
  facilityTypeId: null,
};

export function isDuplicateName(error: unknown) {
  return (
    isAxiosError<{ messageKey?: string }>(error) &&
    error.response?.data?.messageKey === 'requisition.error.validation.templateNameDuplication'
  );
}
