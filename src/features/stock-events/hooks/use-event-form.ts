import { revalidateLogic } from '@tanstack/react-form';
import { useAppForm } from '@/components/form/form';
import {
  type EventFormValues,
  type EventSchemaOptions,
  eventLinesSchema,
} from '@/features/stock-events/lib/event-form';

type Options = EventSchemaOptions & {
  onValid: () => void;
  onInvalid: () => void;
};

export function useEventForm({ onValid, onInvalid, ...options }: Options) {
  return useAppForm({
    defaultValues: { lines: [] } as EventFormValues,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: eventLinesSchema(options) },
    onSubmit: onValid,
    onSubmitInvalid: onInvalid,
  });
}

export type EventForm = ReturnType<typeof useEventForm>;
