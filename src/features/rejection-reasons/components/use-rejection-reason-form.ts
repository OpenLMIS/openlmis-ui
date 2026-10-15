import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { useAppForm } from '@/components/form/form';
import { rejectionReasonCategoriesOptions } from '@/features/reference-data/api/queries';
import type { RejectionReason } from '@/features/reference-data/lib/types';
import { saveRejectionReason } from '@/features/rejection-reasons/api/api';
import {
  EMPTY_REASON_FORM,
  type ReasonFormValues,
  reasonFormSchema,
  toReasonBody,
  toReasonFormValues,
} from '@/features/rejection-reasons/lib/reason-form';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

export const rejectionReasonSaveKey = [...queryKeys.rejectionReasons.all, 'save'] as const;

export function useRejectionReasonForm({
  saved,
  onSaved,
  onInvalid,
}: {
  saved?: RejectionReason;
  onSaved: (reason: RejectionReason) => void;
  onInvalid: () => void;
}) {
  const queryClient = useQueryClient();
  const categories = useQuery(rejectionReasonCategoriesOptions());
  const schema = useMemo(() => reasonFormSchema(categories.data), [categories.data]);
  const save = useSessionMutation({
    mutationKey: rejectionReasonSaveKey,
    mutationFn: (values: ReasonFormValues) =>
      saveRejectionReason(toReasonBody(values, categories.data ?? [], saved)),
    onSuccess: (reason) => {
      void queryClient
        .invalidateQueries({ queryKey: queryKeys.rejectionReasons.all })
        .catch(() => undefined);
      onSaved(reason);
    },
  });
  const form = useAppForm({
    defaultValues: saved ? toReasonFormValues(saved) : EMPTY_REASON_FORM,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => {
      if (save.isPending || save.isSuccess || !categories.isSuccess || categories.isFetching)
        return;
      return save.mutateAsync(value).catch(() => undefined);
    },
    onSubmitInvalid: onInvalid,
  });
  const categoryId = useStore(form.store, (state) => state.values.categoryId);
  const consideredSole = useRef(false);
  useEffect(() => {
    if (saved || consideredSole.current || !categories.isSuccess) return;
    consideredSole.current = true;
    if (
      categories.data.length === 1 &&
      !form.getFieldMeta('categoryId')?.isTouched &&
      !form.getFieldValue('categoryId')
    ) {
      form.setFieldValue('categoryId', categories.data[0].id);
    }
  }, [saved, categories.isSuccess, categories.data, form]);
  const categoryReady =
    categories.isSuccess &&
    !categories.isFetching &&
    categories.data.some((category) => category.id === categoryId);
  return { form, save, categoryReady };
}
