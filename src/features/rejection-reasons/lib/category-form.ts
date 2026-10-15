import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { RejectionReasonCategory } from '@/features/reference-data/lib/types';
import type { RejectionReasonCategoryBody } from '@/features/rejection-reasons/lib/types';

export type CategoryFormValues = { name: string; code: string; active: boolean };

export const EMPTY_CATEGORY_FORM: CategoryFormValues = { name: '', code: '', active: false };

export function toCategoryFormValues(category: RejectionReasonCategory): CategoryFormValues {
  return { name: category.name, code: category.code, active: category.active };
}

export function toCategoryBody(
  values: CategoryFormValues,
  saved?: RejectionReasonCategory,
): RejectionReasonCategoryBody {
  return { ...saved, name: values.name, code: values.code, active: values.active };
}

export const categoryFormSchema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, {
    message: 'rejection-reason-categories.form.name-required' satisfies ParseKeys,
  }),
  code: z.string().refine((value) => value.trim().length > 0, {
    message: 'rejection-reason-categories.form.code-required' satisfies ParseKeys,
  }),
  active: z.boolean(),
});
