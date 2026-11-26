import { z } from 'zod';

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'report-categories.form.name-required'),
});

export const CATEGORY_FIELD_ERRORS = {
  'report.error.reportCategory.name.duplicated': {
    field: 'name',
    key: 'report-categories.form.name-taken',
  },
} as const;
