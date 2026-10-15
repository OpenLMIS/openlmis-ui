import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { RejectionReason, RejectionReasonCategory } from '@/features/reference-data/lib/types';
import type { RejectionReasonBody } from '@/features/rejection-reasons/lib/types';

export type ReasonFormValues = {
  name: string;
  code: string;
  active: boolean;
  categoryId: string;
};

export const EMPTY_REASON_FORM: ReasonFormValues = {
  name: '',
  code: '',
  active: false,
  categoryId: '',
};

export function toReasonFormValues(reason: RejectionReason): ReasonFormValues {
  return {
    name: reason.name,
    code: reason.code,
    active: reason.active,
    categoryId: reason.rejectionReasonCategory.id,
  };
}

export function toReasonBody(
  values: ReasonFormValues,
  categories: RejectionReasonCategory[],
  saved?: RejectionReason,
): RejectionReasonBody {
  const category = categories.find((item) => item.id === values.categoryId);
  if (!category) throw new Error('The selected rejection reason category is unavailable');
  return {
    ...saved,
    name: values.name,
    code: values.code,
    active: values.active,
    rejectionReasonCategory: category,
  };
}

export function reasonFormSchema(categories: RejectionReasonCategory[] | undefined) {
  return z.object({
    name: z.string().refine((value) => value.trim().length > 0, {
      message: 'rejection-reasons.form.name-required' satisfies ParseKeys,
    }),
    code: z.string().refine((value) => value.trim().length > 0, {
      message: 'rejection-reasons.form.code-required' satisfies ParseKeys,
    }),
    active: z.boolean(),
    categoryId: z
      .string()
      .min(1, 'rejection-reasons.form.category-required' satisfies ParseKeys)
      .refine((id) => !id || Boolean(categories?.some((category) => category.id === id)), {
        message: 'rejection-reasons.form.category-unavailable' satisfies ParseKeys,
      }),
  });
}
