import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DialogLoadError,
  ErrorAlert,
  FieldSkeleton,
  SwitchRowSkeleton,
  serverMessage,
} from '@/components/dialog-parts';
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
import { QueryBoundary } from '@/components/query-boundary';
import { FieldGroup } from '@/components/ui/field';
import { createProcessingPeriod } from '@/features/processing-schedules/api/api';
import {
  latestPeriodOptions,
  scheduleDetailOptions,
} from '@/features/processing-schedules/api/queries';
import {
  nextStartDate,
  type PeriodFormValues,
  periodFormSchema,
  previousDate,
  toPeriodBody,
  toPeriodFormValues,
} from '@/features/processing-schedules/lib/period-form';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

const saveKey = (id: string) => [...queryKeys.processingPeriods.all, 'save', id] as const;

type PeriodFormDialogProps = {
  scheduleId: string;
  target: 'new' | undefined;
  onClose: () => void;
  onAdded: (total: number) => void;
};

export function PeriodFormDialog({ scheduleId, target, onClose, onAdded }: PeriodFormDialogProps) {
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(scheduleId) }) > 0;
  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && <PeriodDialogContent scheduleId={scheduleId} onAdded={onAdded} />}
    </FormDialog>
  );
}

function PeriodDialogContent({
  scheduleId,
  onAdded,
}: Pick<PeriodFormDialogProps, 'scheduleId' | 'onAdded'>) {
  const { t } = useTranslation();
  const opening = useOpening();
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) => (
        <DialogLoadError
          error={error}
          errorTitle={t('processing-schedules.period-form.load-error-title')}
          onRetry={reset}
          title={t('processing-schedules.period-form.title')}
        />
      )}
      pendingFallback={<PeriodFormSkeleton />}
      resetKey={scheduleId}
    >
      <PeriodForm scheduleId={scheduleId} opening={opening} onAdded={onAdded} />
    </QueryBoundary>
  );
}

function PeriodForm({
  scheduleId,
  opening,
  onAdded,
}: Pick<PeriodFormDialogProps, 'scheduleId' | 'onAdded'> & { opening: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: schedule } = useSuspenseQuery(scheduleDetailOptions(scheduleId));
  const { data: latest, refetch } = useSuspenseQuery(latestPeriodOptions(scheduleId, opening));
  const startLocked = latest.totalElements > 0;
  const save = useSessionMutation({
    mutationKey: saveKey(scheduleId),
    mutationFn: (values: PeriodFormValues) =>
      createProcessingPeriod(toPeriodBody(values, schedule)),
    onSuccess: async (saved) => {
      toast.success(t('processing-schedules.period-form.added-title'), {
        description: t('processing-schedules.period-form.added', { period: saved.name }),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.processingSchedules.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.processingPeriods.all });
      const refreshed = await refetch();
      if (!save.isCurrent()) return;
      onAdded(
        refreshed.isError || !refreshed.data
          ? latest.totalElements + 1
          : refreshed.data.totalElements,
      );
    },
    onError: async () => {
      const refreshed = await refetch();
      if (!save.isCurrent()) return;
      if (refreshed.data && !refreshed.isError && refreshed.data.totalElements > 0) {
        form.setFieldValue('startDate', nextStartDate(refreshed.data.content[0]?.endDate ?? ''));
      }
    },
  });
  const form = useAppForm({
    defaultValues: toPeriodFormValues(latest.content[0]),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: periodFormSchema },
    onSubmit: ({ value }) => save.mutateAsync(value).catch(() => undefined),
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <PeriodFormHeader />
      <FormDialogBody>
        <FieldGroup>
          {save.isError && (
            <ErrorAlert
              description={
                serverMessage(save.error) ?? t('processing-schedules.period-form.save-error')
              }
              title={t('processing-schedules.period-form.save-error-title')}
            />
          )}
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                autoComplete="off"
                label={t('processing-schedules.periods.name')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="description">
            {(field) => <field.TextField label={t('processing-schedules.periods.description')} />}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.endDate}>
            {(endDate) => (
              <form.AppField name="startDate">
                {(field) => (
                  <field.DateField
                    disabled={startLocked}
                    description={
                      startLocked ? undefined : t('processing-schedules.periods.start-hint')
                    }
                    label={t('processing-schedules.periods.start-date')}
                    latest={!startLocked && endDate ? previousDate(endDate) : undefined}
                    placeholder={t('processing-schedules.period-form.pick-date')}
                    required
                  />
                )}
              </form.AppField>
            )}
          </form.Subscribe>
          <form.Subscribe selector={(state) => state.values.startDate}>
            {(startDate) => (
              <form.AppField name="endDate">
                {(field) => (
                  <field.DateField
                    earliest={startDate ? nextStartDate(startDate) : undefined}
                    label={t('processing-schedules.periods.end-date')}
                    placeholder={t('processing-schedules.period-form.pick-date')}
                    required
                  />
                )}
              </form.AppField>
            )}
          </form.Subscribe>
          <form.AppField name="reportOnly">
            {(field) => (
              <field.SwitchField
                description={t('processing-schedules.period-form.report-only-description')}
                label={t('processing-schedules.periods.report-only')}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>
          {t('processing-schedules.period-form.add')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function PeriodFormHeader() {
  const { t } = useTranslation();
  return (
    <FormDialogHeader>
      <FormDialogTitle>{t('processing-schedules.period-form.title')}</FormDialogTitle>
      <FormDialogDescription>
        {t('processing-schedules.period-form.description')}
      </FormDialogDescription>
    </FormDialogHeader>
  );
}

function PeriodFormSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <PeriodFormHeader />
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('processing-schedules.periods.name')} required />
          <FieldSkeleton label={t('processing-schedules.periods.description')} />
          <FieldSkeleton label={t('processing-schedules.periods.start-date')} required />
          <FieldSkeleton label={t('processing-schedules.periods.end-date')} required />
          <SwitchRowSkeleton label={t('processing-schedules.periods.report-only')} />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{t('processing-schedules.period-form.add')}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
