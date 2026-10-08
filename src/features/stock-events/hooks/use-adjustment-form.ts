import { revalidateLogic } from '@tanstack/react-form';
import { useAppForm } from '@/components/form/form';
import type { Reason } from '@/features/reference-data/lib/types';
import {
  type AdjustmentFormValues,
  adjustmentLinesSchema,
} from '@/features/stock-events/lib/adjustment-form';

type Options = {
  reasons: readonly Reason[];
  today: string;
  onValid: () => void;
  onInvalid: () => void;
};

export function useAdjustmentForm({ reasons, today, onValid, onInvalid }: Options) {
  return useAppForm({
    defaultValues: { lines: [] } as AdjustmentFormValues,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: adjustmentLinesSchema({ reasons, today }) },
    onSubmit: onValid,
    onSubmitInvalid: onInvalid,
  });
}

export type AdjustmentForm = ReturnType<typeof useAdjustmentForm>;
