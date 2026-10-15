import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DialogLoadError,
  DialogNotFound,
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
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import { FieldGroup } from '@/components/ui/field';
import { createProcessingPeriod, fetchLatestPeriod } from '@/features/processing-schedules/api/api';
import {
  latestPeriodOptions,
  periodsListOptions,
  scheduleDetailOptions,
} from '@/features/processing-schedules/api/queries';
import {
  PeriodsTable,
  PeriodsTableSkeleton,
} from '@/features/processing-schedules/components/periods-table';
import {
  nextStartDate,
  type PeriodFormValues,
  periodFormSchema,
  previousDate,
  toPeriodBody,
  toPeriodFormValues,
} from '@/features/processing-schedules/lib/period-form';
import {
  PERIODS_PAGE_SIZE,
  type SchedulesSearch,
  toPeriodsQuery,
} from '@/features/processing-schedules/lib/search';
import type { ProcessingSchedule } from '@/features/reference-data/lib/types';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import type { SearchChange } from '@/lib/table-search';

const saveKey = (id: string) => [...queryKeys.processingPeriods.all, 'save', id] as const;

type PeriodsDialogProps = {
  target: string | undefined;
  search: SchedulesSearch;
  onSearchChange: SearchChange<SchedulesSearch>;
  onClose: () => void;
  onAdded: (scheduleId: string, total: number) => void;
};

export function PeriodsDialog({ target, onClose, ...props }: PeriodsDialogProps) {
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown ?? '') }) > 0;
  const { data: periods } = useQuery({
    ...periodsListOptions(toPeriodsQuery(shown ?? '', props.search)),
    enabled: shown !== undefined,
  });
  const onePage = periods !== undefined && periods.totalElements <= PERIODS_PAGE_SIZE;
  return (
    <FormDialog {...dialogProps(isSaving)} height={onePage ? 'auto' : 'fixed'} size="table">
      {shown && <PeriodDialogContent key={shown} scheduleId={shown} {...props} />}
    </FormDialog>
  );
}

type PeriodDialogContentProps = Pick<
  PeriodsDialogProps,
  'search' | 'onSearchChange' | 'onAdded'
> & { scheduleId: string };

function PeriodDialogContent({ scheduleId, ...props }: PeriodDialogContentProps) {
  const { t } = useTranslation();
  const opening = useOpening();
  const queryClient = useQueryClient();
  const { search } = props;
  useEffect(() => {
    void queryClient.prefetchQuery(latestPeriodOptions(scheduleId, opening));
    void queryClient.prefetchQuery(periodsListOptions(toPeriodsQuery(scheduleId, search)));
  }, [queryClient, scheduleId, opening, search]);
  const title = t('processing-schedules.edit');
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound
            title={title}
            description={t('processing-schedules.periods.not-found-description')}
          />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('processing-schedules.periods.load-error-title')}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={<PeriodFormSkeleton search={props.search} />}
      resetKey={scheduleId}
    >
      <ExistingSchedule scheduleId={scheduleId} opening={opening} {...props} />
    </QueryBoundary>
  );
}

function ExistingSchedule({
  scheduleId,
  opening,
  ...props
}: PeriodDialogContentProps & { opening: number }) {
  const { data: schedule } = useSuspenseQuery(scheduleDetailOptions(scheduleId, opening));
  return <PeriodForm schedule={schedule} opening={opening} {...props} />;
}

function PeriodForm({
  schedule,
  opening,
  onAdded,
  search,
  onSearchChange,
}: Pick<PeriodsDialogProps, 'search' | 'onSearchChange' | 'onAdded'> & {
  schedule: ProcessingSchedule;
  opening: number;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: latest, refetch } = useSuspenseQuery(latestPeriodOptions(schedule.id, opening));
  const [defaults, setDefaults] = useState(() => toPeriodFormValues(latest.content[0]));
  const startLocked = !!defaults.startDate || latest.totalElements > 0;
  const save = useSessionMutation({
    mutationKey: saveKey(schedule.id),
    mutationFn: async (values: PeriodFormValues) => {
      const saved = await createProcessingPeriod(toPeriodBody(values, schedule));
      if (!save.isCurrent()) return { saved, total: latest.totalElements + 1 };
      const refreshed = await fetchLatestPeriod(schedule.id).catch(() => undefined);
      return { saved, total: refreshed?.totalElements ?? latest.totalElements + 1 };
    },
    onSuccess: ({ saved }) => {
      toast.success(t('processing-schedules.period-form.added-title'), {
        description: t('processing-schedules.period-form.added', { period: saved.name }),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.processingSchedules.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.processingPeriods.all });
    },
    onError: async () => {
      const refreshed = await refetch();
      if (!save.isCurrent()) return;
      const end = refreshed.data?.content[0]?.endDate;
      if (end) form.setFieldValue('startDate', nextStartDate(end));
    },
  });
  const form = useAppForm({
    defaultValues: defaults,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: periodFormSchema },
    onSubmit: ({ value }) =>
      save
        .mutateAsync(value, {
          onSuccess: ({ saved, total }) => {
            if (!save.isCurrent()) return;
            const next = toPeriodFormValues(saved);
            setDefaults(next);
            form.reset(next);
            onAdded(schedule.id, total);
          },
        })
        .catch(() => undefined),
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <PeriodFormHeader code={schedule.code} />
      <FormDialogBody layout="table">
        <div className="shrink-0">
          <FieldGroup>
            {save.isError && (
              <ErrorAlert
                description={serverMessage(save.error) ?? t('processing-schedules.save-error')}
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
              {(field) => <field.TextField label={t('processing-schedules.description')} />}
            </form.AppField>
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <form.AppField name="reportOnly">
              {(field) => (
                <field.SwitchField
                  description={t('processing-schedules.period-form.report-only-description')}
                  label={t('processing-schedules.periods.report-only')}
                />
              )}
            </form.AppField>
          </FieldGroup>
          <div className="flex justify-start pt-4">
            <FormDialogSubmit pending={save.isPending}>
              <PlusIcon data-icon="inline-start" />
              {t('processing-schedules.period-form.add')}
            </FormDialogSubmit>
          </div>
        </div>
        <div className="grid min-h-32 flex-auto">
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('processing-schedules.periods.error-description')}
                error={error}
                reset={reset}
                title={t('processing-schedules.periods.error-title')}
              />
            )}
            pendingFallback={<PeriodsTableSkeleton search={search} />}
            resetKey={schedule.id}
          >
            <PeriodsTable
              scheduleId={schedule.id}
              scheduleCode={schedule.code}
              search={search}
              onSearchChange={onSearchChange}
            />
          </QueryBoundary>
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function PeriodFormHeader({ code }: { code?: string }) {
  const { t } = useTranslation();
  return (
    <FormDialogHeader>
      <FormDialogTitle>
        {code ? t('processing-schedules.periods.title', { code }) : t('processing-schedules.edit')}
      </FormDialogTitle>
      <FormDialogDescription>
        {t('processing-schedules.period-form.description')}
      </FormDialogDescription>
    </FormDialogHeader>
  );
}

function PeriodFormSkeleton({ search }: { search: SchedulesSearch }) {
  const { t } = useTranslation();
  return (
    <>
      <PeriodFormHeader />
      <FormDialogBody layout="table">
        <div className="shrink-0">
          <FieldGroup>
            <FieldSkeleton label={t('processing-schedules.periods.name')} required />
            <FieldSkeleton label={t('processing-schedules.description')} />
            <div className="grid grid-cols-2 gap-4">
              <FieldSkeleton label={t('processing-schedules.periods.start-date')} required />
              <FieldSkeleton label={t('processing-schedules.periods.end-date')} required />
            </div>
            <SwitchRowSkeleton label={t('processing-schedules.periods.report-only')} />
          </FieldGroup>
          <div className="flex justify-start pt-4">
            <FormDialogSubmit disabled>
              <PlusIcon data-icon="inline-start" />
              {t('processing-schedules.period-form.add')}
            </FormDialogSubmit>
          </div>
        </div>
        <div className="grid min-h-32 flex-auto">
          <PeriodsTableSkeleton search={search} />
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}
