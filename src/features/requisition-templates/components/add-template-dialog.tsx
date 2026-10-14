import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useIsMutating, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableHeaderLabel,
} from '@/components/data-table/data-table';
import { ErrorAlert, LookupBoundary, serverMessage } from '@/components/dialog-parts';
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
import { Button } from '@/components/ui/button';
import { FieldError, FieldGroup } from '@/components/ui/field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { facilityTypesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import { programName } from '@/features/reference-data/lib/programs';
import { createRequisitionTemplate } from '@/features/requisition-templates/api/api';
import {
  availableColumnsOptions,
  requisitionTemplatesOptions,
} from '@/features/requisition-templates/api/queries';
import {
  type AddTemplateFormValues,
  addTemplateFormSchema,
  EMPTY_ADD_TEMPLATE_FORM,
  isDuplicateName,
} from '@/features/requisition-templates/lib/add-template-form';
import { eligibleForNewTemplate } from '@/features/requisition-templates/lib/eligible-facility-types';
import { buildNewTemplate } from '@/features/requisition-templates/lib/new-template';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

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
  return (
    <FormDialog size="xl" {...dialogProps(pending)}>
      {shown && <AddTemplateForm />}
    </FormDialog>
  );
}

function useTemplateForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [refused, setRefused] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<AddTemplateFormValues | null>(null);
  const schema = useMemo(() => addTemplateFormSchema(refused), [refused]);
  const save = useSessionMutation({
    mutationKey: SAVE_KEY,
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
      if (isDuplicateName(error)) setRefused((names) => [...names, values.name.trim()]);
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
  return { form, save, confirmation, setConfirmation, confirm };
}

type TemplateForm = ReturnType<typeof useTemplateForm>['form'];

function AddTemplateForm() {
  const { t } = useTranslation();
  const { form, save, confirmation, setConfirmation, confirm } = useTemplateForm();
  const queryClient = useQueryClient();
  const clearTypes = () => {
    form.setFieldValue('facilityTypeIds', []);
    form.setFieldValue('facilityTypeId', null);
  };
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
            {save.isError && !isDuplicateName(save.error) && (
              <ErrorAlert
                title={t('requisition-templates.form.save-error-title')}
                description={
                  serverMessage(save.error) ?? t('requisition-templates.form.save-error')
                }
              />
            )}
            <form.AppField name="name">
              {(field) => (
                <field.TextField
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
              <ProgramField form={form} clearTypes={clearTypes} />
            </LookupBoundary>
            <form.AppField name="requisitionReportOnly" listeners={{ onChange: clearTypes }}>
              {(field) => <field.SwitchField label={t('requisition-templates.report-only')} />}
            </form.AppField>
            <LookupBoundary
              label={t('requisition-templates.form.facility-type')}
              errorTitle={t('requisition-templates.form.lookup-error')}
              errorDescription={t('error.check-connection')}
            >
              <FacilityTypesFields form={form} />
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

function ProgramField({ form, clearTypes }: { form: TemplateForm; clearTypes: () => void }) {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(programsOptions());
  return (
    <form.AppField name="programId" listeners={{ onChange: clearTypes }}>
      {(field) => (
        <field.ComboboxField
          clearLabel={t('requisition-templates.form.clear-program')}
          emptyMessage={t('requisition-templates.no-programs')}
          items={programs.map((program) => ({ value: program.id, label: programName(program) }))}
          label={t('requisition-templates.form.program')}
          placeholder={t('requisition-templates.form.pick-program')}
          required
        />
      )}
    </form.AppField>
  );
}

function FacilityTypesFields({ form }: { form: TemplateForm }) {
  const { t } = useTranslation();
  const { data: types } = useSuspenseQuery(facilityTypesOptions({ active: true }));
  const { data: templates } = useSuspenseQuery(requisitionTemplatesOptions());
  const values = useStore(form.store, (state) => state.values);
  const formatError = useFormatError();
  const options = eligibleForNewTemplate(
    types,
    templates,
    values.programId,
    values.requisitionReportOnly,
    values.facilityTypeIds,
  );
  const rows = types
    .filter(({ id }) => values.facilityTypeIds.includes(id))
    .sort((a, b) => facilityTypeName(a).localeCompare(facilityTypeName(b)));
  const tableRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const remove = (id: string, index: number) => {
    form.setFieldValue(
      'facilityTypeIds',
      values.facilityTypeIds.filter((value) => value !== id),
    );
    requestAnimationFrame(() => {
      const buttons = tableRef.current?.querySelectorAll<HTMLButtonElement>('[data-remove-type]');
      const next = buttons?.[Math.min(index, buttons.length - 1)];
      (next ?? pickerRef.current?.querySelector<HTMLInputElement>('input'))?.focus();
    });
  };
  const picked = options.some(({ id }) => id === values.facilityTypeId);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1" ref={pickerRef}>
          <form.AppField name="facilityTypeId">
            {(field) => (
              <field.ComboboxField
                clearLabel={t('requisition-templates.form.clear-facility-type')}
                disabled={!values.programId || !options.length}
                description={
                  !values.programId
                    ? t('requisition-templates.form.select-program-first')
                    : undefined
                }
                emptyMessage={t('requisition-templates.form.no-types-left')}
                items={options.map((type) => ({ value: type.id, label: facilityTypeName(type) }))}
                label={t('requisition-templates.form.facility-type')}
                placeholder={t(
                  values.programId && !options.length
                    ? 'requisition-templates.form.no-types-left'
                    : 'requisition-templates.form.pick-facility-type',
                )}
              />
            )}
          </form.AppField>
        </div>
        <Button
          disabled={!picked}
          onClick={() => {
            if (!values.facilityTypeId || !picked) return;
            form.pushFieldValue('facilityTypeIds', values.facilityTypeId);
            form.setFieldValue('facilityTypeId', null);
          }}
          type="button"
          variant="outline"
        >
          <PlusIcon data-icon="inline-start" />
          {t('requisition-templates.form.add-facility-type')}
        </Button>
      </div>
      <div ref={tableRef}>
        <DataTableCard>
          <Table density="comfortable" layout="auto">
            <TableHeader surface="muted">
              <TableRow>
                <TableHead>
                  <DataTableHeaderLabel>
                    {t('requisition-templates.form.facility-type-name')}
                  </DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <DataTableHeaderLabel>{t('requisition-templates.action')}</DataTableHeaderLabel>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((type, index) => (
                  <TableRow key={type.id}>
                    <TableCell>
                      <span dir="auto">{facilityTypeName(type)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          aria-label={t('requisition-templates.form.remove-type', {
                            type: facilityTypeName(type),
                          })}
                          data-remove-type
                          onClick={() => remove(type.id, index)}
                          size="icon-sm"
                          type="button"
                          variant="destructive"
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2}>
                    <DataTableEmpty title={t('requisition-templates.form.no-types')} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableCard>
      </div>
      <form.AppField name="facilityTypeIds">
        {(field) =>
          field.state.meta.isTouched && field.state.meta.errors.length ? (
            <FieldError>
              {field.state.meta.errors
                .map((error) =>
                  formatError(typeof error === 'string' ? error : (error?.message ?? '')),
                )
                .join(' ')}
            </FieldError>
          ) : null
        }
      </form.AppField>
    </div>
  );
}
