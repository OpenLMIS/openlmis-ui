import { revalidateLogic } from '@tanstack/react-form';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  FieldSkeleton,
  SkeletonLine,
  SwitchSkeleton,
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
import { createProgram, updateProgram } from '@/features/programs/api/api';
import { programDetailOptions } from '@/features/programs/api/queries';
import {
  EMPTY_PROGRAM_FORM,
  isDuplicateCode,
  type ProgramFormValues,
  programFormSchema,
  toProgramBody,
  toProgramFormValues,
} from '@/features/programs/lib/program-form';
import { programsOptions } from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import type { Program } from '@/features/reference-data/lib/types';
import { useOpening } from '@/hooks/use-opening';
import { isNotFound } from '@/lib/http';
import { queryKeys, userProgramsKey } from '@/lib/key-factory';

const NO_PROGRAMS: Program[] = [];

type SwitchName = {
  [K in keyof ProgramFormValues]: ProgramFormValues[K] extends boolean ? K : never;
}[keyof ProgramFormValues];

const SWITCHES: readonly {
  name: SwitchName;
  labelKey: ParseKeys;
  descriptionKey?: ParseKeys;
}[] = [
  { name: 'active', labelKey: 'programs.form.active' },
  {
    name: 'showNonFullSupplyTab',
    labelKey: 'programs.form.non-full-supply',
    descriptionKey: 'programs.form.non-full-supply-description',
  },
  {
    name: 'periodsSkippable',
    labelKey: 'programs.form.skip-periods',
    descriptionKey: 'programs.form.skip-periods-description',
  },
  {
    name: 'skipAuthorization',
    labelKey: 'programs.form.skip-authorization',
    descriptionKey: 'programs.form.skip-authorization-description',
  },
  {
    name: 'enableDatePhysicalStockCountCompleted',
    labelKey: 'programs.form.stock-count-date',
    descriptionKey: 'programs.form.stock-count-date-description',
  },
];

const saveKey = (target: string) => [...queryKeys.programs.all, 'save', target] as const;

type ProgramFormDialogProps = {
  target: 'new' | string | undefined;
  onClose: () => void;
};

export function ProgramFormDialog({ target, onClose }: ProgramFormDialogProps) {
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown ?? 'new') }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && <ProgramDialogContent onDone={onClose} target={shown} />}
    </FormDialog>
  );
}

function ProgramDialogContent({ target, onDone }: { target: string; onDone: () => void }) {
  const { t } = useTranslation();
  const isNew = target === 'new';
  const title = t(isNew ? 'programs.form.create-title' : 'programs.form.edit-title');
  const opening = useOpening();

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound description={t('programs.form.not-found')} title={title} />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('programs.form.load-error-title')}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={
        <ProgramFormSkeleton
          submitLabel={t(isNew ? 'programs.form.create' : 'programs.form.save')}
          title={title}
        />
      }
      resetKey={target}
    >
      {isNew ? (
        <ProgramForm onDone={onDone} />
      ) : (
        <ExistingProgram key={target} onDone={onDone} opening={opening} programId={target} />
      )}
    </QueryBoundary>
  );
}

type ExistingProgramProps = { programId: string; opening: number; onDone: () => void };

function ExistingProgram({ programId, opening, onDone }: ExistingProgramProps) {
  const { data: program } = useSuspenseQuery(programDetailOptions(programId, opening));
  return <ProgramForm onDone={onDone} program={program} />;
}

type ProgramFormProps = {
  program?: Program;
  onDone: () => void;
};

function ProgramForm({ program, onDone }: ProgramFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: programs = NO_PROGRAMS } = useQuery({
    ...programsOptions(),
    staleTime: 0,
    enabled: !program,
  });
  const [refused, setRefused] = useState<string[]>([]);
  const schema = useMemo(
    () => programFormSchema(program ? [] : [...programs.map(({ code }) => code), ...refused]),
    [programs, refused, program],
  );

  const save = useMutation({
    mutationKey: saveKey(program?.id ?? 'new'),
    mutationFn: (values: ProgramFormValues) => {
      const body = toProgramBody(values, program);
      return program ? updateProgram(program.id, body) : createProgram(body);
    },
    onSuccess: (saved) => {
      toast.success(t(program ? 'programs.form.updated-title' : 'programs.form.created-title'), {
        description: t(program ? 'programs.form.updated' : 'programs.form.created', {
          program: programName(saved),
        }),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.programs.all,
        predicate: (query) => query.queryKey[1] !== 'detail',
      });
      void queryClient.invalidateQueries({ queryKey: userProgramsKey() });
    },
    onError: (error, values) => {
      if (!isDuplicateCode(error)) return;
      setRefused((taken) => [...taken, values.code]);
    },
  });

  const form = useAppForm({
    defaultValues: program ? toProgramFormValues(program) : EMPTY_PROGRAM_FORM,
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
        <FormDialogTitle>
          {t(program ? 'programs.form.edit-title' : 'programs.form.create-title')}
        </FormDialogTitle>
        <FormDialogDescription>{t('programs.form.description-note')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && !isDuplicateCode(save.error) && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('programs.form.save-error')}
              title={t('programs.form.save-error-title')}
            />
          )}
          <form.AppField name="code">
            {(field) => (
              <field.TextField
                autoComplete="off"
                description={program ? t('programs.form.code-locked') : undefined}
                dir="ltr"
                disabled={Boolean(program)}
                label={t('programs.form.code')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="name">
            {(field) => (
              <field.TextField autoComplete="off" label={t('programs.form.name')} required />
            )}
          </form.AppField>
          <form.AppField name="description">
            {(field) => <field.TextareaField label={t('programs.form.description')} />}
          </form.AppField>
          {SWITCHES.map((setting) => (
            <form.AppField key={setting.name} name={setting.name}>
              {(field) => (
                <field.SwitchField
                  description={setting.descriptionKey && t(setting.descriptionKey)}
                  label={t(setting.labelKey)}
                />
              )}
            </form.AppField>
          ))}
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>
          {t(program ? 'programs.form.save' : 'programs.form.create')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function ProgramFormSkeleton({ title, submitLabel }: { title: string; submitLabel: string }) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <SkeletonLine width="medium" />
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('programs.form.code')} required />
          <FieldSkeleton label={t('programs.form.name')} required />
          <FieldSkeleton label={t('programs.form.description')} />
          {SWITCHES.map((setting) => (
            <SwitchSkeleton key={setting.name} />
          ))}
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{submitLabel}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
