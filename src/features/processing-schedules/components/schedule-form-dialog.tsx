import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { FieldGroup } from '@/components/ui/field';
import { createProcessingSchedule } from '@/features/processing-schedules/api/api';
import {
  duplicateField,
  EMPTY_SCHEDULE_FORM,
  type ScheduleFormValues,
  scheduleFormSchema,
  type TakenSchedule,
  toScheduleBody,
} from '@/features/processing-schedules/lib/schedule-form';
import { processingSchedulesOptions } from '@/features/reference-data/api/queries';
import type { ProcessingSchedule } from '@/features/reference-data/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

const NO_SCHEDULES: ProcessingSchedule[] = [];
const SAVE_KEY = [...queryKeys.processingSchedules.all, 'save', 'new'] as const;

type ScheduleFormDialogProps = {
  target: 'new' | undefined;
  onClose: () => void;
};

export function ScheduleFormDialog({ target, onClose }: ScheduleFormDialogProps) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: SAVE_KEY }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>{shown && <ScheduleForm onDone={close} />}</FormDialog>
  );
}

function ScheduleForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: schedules = NO_SCHEDULES } = useQuery({
    ...processingSchedulesOptions(),
    staleTime: 0,
  });
  const [refused, setRefused] = useState<TakenSchedule[]>([]);
  const schema = useMemo(() => scheduleFormSchema(schedules, refused), [schedules, refused]);
  const save = useSessionMutation({
    mutationKey: SAVE_KEY,
    mutationFn: (values: ScheduleFormValues) => createProcessingSchedule(toScheduleBody(values)),
    onSuccess: (saved) => {
      toast.success(t('processing-schedules.form.created-title'), {
        description: t('processing-schedules.form.created', { schedule: saved.name }),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.processingSchedules.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.processingPeriods.all });
    },
    onError: (error, values) => {
      const field = duplicateField(error);
      if (!field) return;
      setRefused((taken) => [
        ...taken,
        {
          code: field === 'code' ? values.code : '',
          name: field === 'name' ? values.name : '',
        },
      ]);
    },
  });
  const refusedField = duplicateField(save.error);
  const form = useAppForm({
    defaultValues: EMPTY_SCHEDULE_FORM,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => save.mutateAsync(value, { onSuccess: onDone }).catch(() => undefined),
  });

  useEffect(() => {
    if (refused.length > 0) void form.validate('change');
  }, [refused, form]);

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('processing-schedules.form.create-title')}</FormDialogTitle>
        <FormDialogDescription>
          {t('processing-schedules.form.create-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && !refusedField && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('processing-schedules.form.save-error')}
              title={t('processing-schedules.form.save-error-title')}
            />
          )}
          <form.AppField name="code">
            {(field) => (
              <field.TextField
                autoComplete="off"
                dir="ltr"
                label={t('processing-schedules.code')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="name">
            {(field) => (
              <field.TextField autoComplete="off" label={t('processing-schedules.name')} required />
            )}
          </form.AppField>
          <form.AppField name="description">
            {(field) => <field.TextField label={t('processing-schedules.description')} />}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>
          {t('processing-schedules.form.save')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
