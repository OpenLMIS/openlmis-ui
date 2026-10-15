import { revalidateLogic } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForm } from '@/components/form/form';
import type { RejectionReasonCategory } from '@/features/reference-data/lib/types';
import { saveRejectionReasonCategory } from '@/features/rejection-reasons/api/api';
import {
  type CategoryFormValues,
  categoryFormSchema,
  EMPTY_CATEGORY_FORM,
  toCategoryBody,
  toCategoryFormValues,
} from '@/features/rejection-reasons/lib/category-form';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

export const categorySaveKey = [...queryKeys.rejectionReasonCategories.all, 'save'] as const;

export function useCategoryForm({
  saved,
  onSaved,
  onInvalid,
}: {
  saved?: RejectionReasonCategory;
  onSaved: (category: RejectionReasonCategory) => void;
  onInvalid: () => void;
}) {
  const queryClient = useQueryClient();
  const save = useSessionMutation({
    mutationKey: categorySaveKey,
    mutationFn: (values: CategoryFormValues) =>
      saveRejectionReasonCategory(toCategoryBody(values, saved)),
    onSuccess: (category) => {
      void queryClient
        .invalidateQueries({ queryKey: queryKeys.rejectionReasonCategories.all })
        .catch(() => undefined);
      void queryClient
        .invalidateQueries({ queryKey: queryKeys.rejectionReasons.all })
        .catch(() => undefined);
      onSaved(category);
    },
  });
  const form = useAppForm({
    defaultValues: saved ? toCategoryFormValues(saved) : EMPTY_CATEGORY_FORM,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: categoryFormSchema },
    onSubmit: ({ value }) => {
      if (save.isPending || save.isSuccess) return;
      return save.mutateAsync(value).catch(() => undefined);
    },
    onSubmitInvalid: onInvalid,
  });
  return { form, save };
}
