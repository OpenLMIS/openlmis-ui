import { z } from 'zod';

export const CATALOG_NAME_MAX = 255;
export const CATALOG_DESCRIPTION_MAX = 4000;

export const catalogFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'manage-buq.form.name-required')
    .max(CATALOG_NAME_MAX, 'manage-buq.form.name-too-long'),
  description: z
    .string()
    .trim()
    .max(CATALOG_DESCRIPTION_MAX, 'manage-buq.form.description-too-long'),
});

export const CATALOG_FIELD_ERRORS = {
  'buq.error.remark.name.duplicated': { field: 'name', key: 'manage-buq.form.name-taken' },
  'buq.error.sourceOfFund.name.duplicated': { field: 'name', key: 'manage-buq.form.name-taken' },
} as const;
