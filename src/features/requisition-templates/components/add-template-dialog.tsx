import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useIsMutating, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, LookupBoundary } from '@/components/display/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { useFormatError } from '@/components/form/form-messages';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { facilityTypesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import { createRequisitionTemplate } from '@/features/requisition-templates/api/api';
import {
  availableColumnsOptions,
  requisitionTemplatesOptions,
} from '@/features/requisition-templates/api/queries';
import { FacilityTypesFields } from '@/features/requisition-templates/components/facility-types-fields';
import {
  type AddTemplateFormValues,
  addTemplateFormSchema,
  EMPTY_ADD_TEMPLATE_FORM,
  TEMPLATE_FIELD_ERRORS,
} from '@/features/requisition-templates/lib/add-template-form';
import { eligibleForNewTemplate } from '@/features/requisition-templates/lib/eligible-facility-types';
import { buildNewTemplate } from '@/features/requisition-templates/lib/new-template';
import { templateFieldErrors } from '@/features/requisition-templates/lib/server-errors';
import { useDialogCardLayout } from '@/hooks/use-card-view';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { apiErrorText, fieldErrorFor } from '@/lib/api-error';
import { queryKeys } from '@/lib/key-factory';
import { reportApiError } from '@/lib/report-error';

const SAVE_KEY = [...queryKeys.requisitionTemplates.all, 'create'] as const;

export function AddTemplateDialog({
  target,
  onClose,
}: {
  target: 'new' | undefined;
  onClose: () => void;
}) {
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  const pending = useIsMutating({ mutationKey: SAVE_KEY }) > 0;
  const { measure, cards } = useDialogCardLayout('lg');
  return (
    <FormDialog size="lg" {...dialogProps(pending)}>
      <div className="flex min-h-0 flex-1 flex-col" ref={measure}>
        {shown && <AddTemplateForm cards={cards} />}
      </div>
    </FormDialog>
  );
}

function useTemplateForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [refused, setRefused] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof templateFieldErrors>>();
  const [confirmation, setConfirmation] = useState<AddTemplateFormValues | null>(null);
  const schema = useMemo(() => addTemplateFormSchema(refused), [refused]);
  const save = useSessionMutation({
    mutationKey: SAVE_KEY,
    onMutate: () => setFieldErrors(undefined),
    mutationFn: async (values: AddTemplateFormValues) => {
      const catalog = await queryClient.ensureQueryData(availableColumnsOptions());
      if (!save.isCurrent()) throw new Error(t('requisition-templates.form.save-error'));
      return createRequisitionTemplate(buildNewTemplate(catalog, values));
    },
    onSuccess: () => {
      toast.success(t('requisition-templates.form.created-title'), {
        description: t('requisition-templates.form.created'),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.requisitionTemplates.all });
    },
    onError: (error, values) => {
      reportApiError(error);
      if (fieldErrorFor(error, TEMPLATE_FIELD_ERRORS))
        setRefused((names) => [...names, values.name.trim()]);
      setFieldErrors(templateFieldErrors(error, t));
    },
  });
  const form = useAppForm({
    defaultValues: EMPTY_ADD_TEMPLATE_FORM,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => setConfirmation(value),
  });
  useEffect(() => {
    queryClient.prefetchQuery(availableColumnsOptions());
    queryClient.prefetchQuery(facilityTypesOptions({ active: true }));
  }, [queryClient]);
  useEffect(() => {
    if (refused.length) void form.validate('change');
  }, [refused, form]);
  const confirm = () => {
    if (!confirmation || save.isPending) return;
    void save
      .mutateAsync(confirmation, {
        onSuccess: (created) => {
          void navigate({
            to: '/administration/requisition-templates/$id',
            params: { id: created.id },
            replace: true,
          });
        },
        onSettled: () => setConfirmation(null),
      })
      .catch(() => undefined);
  };
  const clearFieldError = (field: 'program' | 'facilityTypes') =>
    setFieldErrors((errors) => errors && { ...errors, [field]: undefined });
  return { form, save, fieldErrors, clearFieldError, confirmation, setConfirmation, confirm };
}

type TemplateForm = ReturnType<typeof useTemplateForm>['form'];

function AddTemplateForm({ cards }: { cards: boolean }) {
  const { t } = useTranslation();
  const { form, save, fieldErrors, clearFieldError, confirmation, setConfirmation, confirm } =
    useTemplateForm();
  const queryClient = useQueryClient();
  const clearTypes = () => {
    form.setFieldValue('facilityTypeIds', []);
    clearFieldError('facilityTypes');
  };
  const generalError =
    !save.isError || fieldErrorFor(save.error, TEMPLATE_FIELD_ERRORS)
      ? null
      : fieldErrors
        ? [fieldErrors.general, fieldErrors.columns, fieldErrors.periods].filter(Boolean).join(' ')
        : apiErrorText(save.error, 'requisition-templates.form.save-error', t, { write: true });
  const program = queryClient
    .getQueryData(programsOptions().queryKey)
    ?.find(({ id }) => id === confirmation?.programId);
  return (
    <>
      <FormDialogForm onSubmit={form.handleSubmit}>
        <FormDialogHeader>
          <FormDialogTitle>{t('requisition-templates.add')}</FormDialogTitle>
          <FormDialogDescription>
            {t('requisition-templates.form.description')}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <FieldGroup>
            {generalError && (
              <ErrorAlert
                title={t('requisition-templates.form.save-error-title')}
                description={generalError}
              />
            )}
            <form.AppField name="name">
              {(field) => (
                <field.TextField
                  dir="auto"
                  autoComplete="off"
                  label={t('requisition-templates.form.name')}
                  required
                />
              )}
            </form.AppField>
            <LookupBoundary
              label={t('requisition-templates.form.program')}
              required
              errorTitle={t('requisition-templates.form.lookup-error')}
              errorDescription={t('error.check-connection')}
            >
              <ProgramField
                form={form}
                error={fieldErrors?.program}
                clearTypes={() => {
                  clearFieldError('program');
                  clearTypes();
                }}
              />
            </LookupBoundary>
            <form.AppField name="requisitionReportOnly" listeners={{ onChange: clearTypes }}>
              {(field) => <field.SwitchField label={t('requisition-templates.report-only')} />}
            </form.AppField>
            <Separator />
            <LookupBoundary
              label={t('requisition-templates.form.facility-type')}
              errorTitle={t('requisition-templates.form.lookup-error')}
              errorDescription={t('error.check-connection')}
            >
              <AddFacilityTypes
                cards={cards}
                form={form}
                serverError={fieldErrors?.facilityTypes}
                clearServerError={() => clearFieldError('facilityTypes')}
              />
            </LookupBoundary>
          </FieldGroup>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
          <FormDialogSubmit pending={save.isPending}>
            {t('requisition-templates.form.create')}
          </FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('requisition-templates.form.confirm-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('requisition-templates.form.confirm', {
                program: program ? programName(program) : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={save.isPending} onClick={confirm}>
              {t('requisition-templates.form.create')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProgramField({
  form,
  clearTypes,
  error,
}: {
  form: TemplateForm;
  clearTypes: () => void;
  error: string | undefined;
}) {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(programsOptions());
  const errorId = useId();
  return (
    <>
      <form.AppField name="programId" listeners={{ onChange: clearTypes }}>
        {(field) => (
          <field.ComboboxField
            invalid={Boolean(error)}
            describedBy={error ? errorId : undefined}
            clearLabel={t('requisition-templates.form.clear-program')}
            emptyMessage={t('requisition-templates.no-programs')}
            items={programs.map((program) => ({ value: program.id, label: programName(program) }))}
            label={t('requisition-templates.form.program')}
            placeholder={t('requisition-templates.form.pick-program')}
            required
          />
        )}
      </form.AppField>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </>
  );
}

function AddFacilityTypes({
  cards,
  form,
  serverError,
  clearServerError,
}: {
  cards: boolean;
  form: TemplateForm;
  serverError: string | undefined;
  clearServerError: () => void;
}) {
  const { t } = useTranslation();
  const { data: types } = useSuspenseQuery(facilityTypesOptions({ active: true }));
  const { data: templates } = useSuspenseQuery(requisitionTemplatesOptions());
  const values = useStore(form.store, (state) => state.values);
  const formatError = useFormatError();
  return (
    <form.AppField name="facilityTypeIds">
      {(field) => (
        <FacilityTypesFields
          size="default"
          dialogCards={cards}
          key={`${values.programId}-${values.requisitionReportOnly}`}
          label={t('requisition-templates.form.facility-type')}
          addLabel={t('requisition-templates.form.add-facility-type')}
          options={eligibleForNewTemplate(
            types,
            templates,
            values.programId,
            values.requisitionReportOnly,
            values.facilityTypeIds,
          )}
          types={types}
          selected={values.facilityTypeIds}
          onChange={(ids) => {
            clearServerError();
            field.handleChange(ids);
            field.handleBlur();
          }}
          disabled={!values.programId}
          placeholder={
            !values.programId ? t('requisition-templates.form.select-program-first') : undefined
          }
          error={
            serverError ??
            (field.state.meta.isTouched && field.state.meta.errors.length
              ? field.state.meta.errors
                  .map((error) =>
                    formatError(typeof error === 'string' ? error : (error?.message ?? '')),
                  )
                  .join(' ')
              : undefined)
          }
          emptyTitle={t('requisition-templates.form.no-types')}
          emptyDescription={t('requisition-templates.form.no-types-description')}
        />
      )}
    </form.AppField>
  );
}
