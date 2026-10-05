import { revalidateLogic, useStore } from '@tanstack/react-form';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { BuildingIcon, UsersIcon } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, LookupBoundary, serverMessage } from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { ComboboxField, SelectField } from '@/components/form/form-fields';
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
import {
  type AssignmentFormValues,
  assignmentFormSchema,
  EMPTY_ASSIGNMENT_FORM,
  toAssignmentBody,
} from '@/components/valid-assignments/assignment-form';
import { toFacilityOption, toProgramOption } from '@/components/valid-assignments/options';
import type { AssignmentsApi } from '@/components/valid-assignments/types';
import {
  facilityTypesOptions,
  geographicLevelsOptions,
  minimalFacilitiesOptions,
  organizationsOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';

type AddAssignmentDialogProps = {
  api: AssignmentsApi;
  open: boolean;
  onClose: () => void;
  canPickOrganizations: boolean;
};

const saveKey = (api: AssignmentsApi) => [...api.queryKey, 'create'];

const toLabel = (lookup: { code: string; name: string | null } | undefined) =>
  lookup && (lookup.name || lookup.code);

export function AddAssignmentDialog({
  api,
  open,
  onClose,
  canPickOrganizations,
}: AddAssignmentDialogProps) {
  const { shown, dialogProps } = useDialogTarget(open || undefined, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(api) }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && (
        <AddAssignmentForm api={api} canPickOrganizations={canPickOrganizations} onDone={onClose} />
      )}
    </FormDialog>
  );
}

function AddAssignmentForm({
  api,
  canPickOrganizations,
  onDone,
}: {
  api: AssignmentsApi;
  canPickOrganizations: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationKey: saveKey(api),
    mutationFn: (values: AssignmentFormValues) => api.create(toAssignmentBody(values)),
    onSuccess: ({ assignment, created }) => {
      const names = {
        name: assignment.name ?? '',
        type: toLabel(
          queryClient
            .getQueryData(facilityTypesOptions({ active: true }).queryKey)
            ?.find((type) => type.id === assignment.facilityTypeId),
        ),
        program: toLabel(
          queryClient
            .getQueryData(programsOptions().queryKey)
            ?.find((program) => program.id === assignment.programId),
        ),
      };
      if (created) {
        toast.success(t('valid-assignments.form.created-title', { kind: api.kind }), {
          description: t('valid-assignments.form.created', names),
        });
      } else {
        toast.info(t('valid-assignments.form.exists-title', { kind: api.kind }), {
          description: t('valid-assignments.form.exists', names),
        });
      }
      void queryClient.invalidateQueries({ queryKey: api.queryKey });
    },
  });

  const form = useAppForm({
    defaultValues: EMPTY_ASSIGNMENT_FORM,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: assignmentFormSchema },
    onSubmit: ({ value }) => save.mutateAsync(value, { onSuccess: onDone }).catch(() => undefined),
  });
  const nodeType = useStore(form.store, (state) => state.values.nodeType);

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('valid-assignments.add', { kind: api.kind })}</FormDialogTitle>
        <FormDialogDescription>
          {t('valid-assignments.form.description', { kind: api.kind })}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('valid-assignments.form.save-error')}
              title={t('valid-assignments.form.save-error-title')}
            />
          )}
          <LookupField label={t('valid-assignments.program')} required>
            <form.AppField name="programId">{() => <ProgramSelect />}</form.AppField>
          </LookupField>
          <LookupField label={t('valid-assignments.facility-type')} required>
            <form.AppField name="facilityTypeId">{() => <FacilityTypeSelect />}</form.AppField>
          </LookupField>
          {canPickOrganizations && (
            <form.AppField name="nodeType">
              {(field) => (
                <field.RadioGroupField
                  columns="row"
                  label={t('valid-assignments.form.node-type')}
                  options={[
                    {
                      value: 'facility',
                      label: t('valid-assignments.facility'),
                      description: t('valid-assignments.form.is-facility-description'),
                      media: <BuildingIcon />,
                    },
                    {
                      value: 'organization',
                      label: t('valid-assignments.organization'),
                      description: t('valid-assignments.form.is-organization-description'),
                      media: <UsersIcon />,
                    },
                  ]}
                />
              )}
            </form.AppField>
          )}
          {nodeType === 'organization' ? (
            <LookupField label={t('valid-assignments.organization')} required>
              <form.AppField name="organizationId">{() => <OrganizationSelect />}</form.AppField>
            </LookupField>
          ) : (
            <LookupField label={t('valid-assignments.facility')} required>
              <form.AppField name="facilityId">{() => <FacilityCombobox />}</form.AppField>
            </LookupField>
          )}
          <LookupField label={t('valid-assignments.geo-level-affinity')}>
            <form.AppField name="geoLevelAffinityId">{() => <GeoLevelCombobox />}</form.AppField>
          </LookupField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>
          {t('valid-assignments.form.create')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function ProgramSelect() {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(programsOptions());
  const items = useMemo(() => data.map(toProgramOption), [data]);
  return <SelectField items={items} label={t('valid-assignments.program')} required />;
}

function FacilityTypeSelect() {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(facilityTypesOptions({ active: true }));
  const items = useMemo(
    () => data.map((type) => ({ value: type.id, label: type.name || type.code })),
    [data],
  );
  return <SelectField items={items} label={t('valid-assignments.facility-type')} required />;
}

function FacilityCombobox() {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(minimalFacilitiesOptions());
  const items = useMemo(() => data.map(toFacilityOption), [data]);
  return (
    <ComboboxField
      clearLabel={t('valid-assignments.form.clear-facility')}
      emptyMessage={t('data-table.no-matches')}
      items={items}
      label={t('valid-assignments.facility')}
      required
    />
  );
}

function OrganizationSelect() {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(organizationsOptions());
  const items = useMemo(
    () => data.map((organization) => ({ value: organization.id, label: organization.name })),
    [data],
  );
  return <SelectField items={items} label={t('valid-assignments.organization')} required />;
}

function GeoLevelCombobox() {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(geographicLevelsOptions());
  const items = useMemo(
    () =>
      data.map((level) => ({
        value: level.id,
        label: level.name || level.code,
        description: t('valid-assignments.form.level', { level: level.levelNumber }),
      })),
    [data, t],
  );
  return (
    <ComboboxField
      clearLabel={t('valid-assignments.form.clear-geo-level-affinity')}
      description={t('valid-assignments.form.geo-level-affinity-description')}
      emptyMessage={t('data-table.no-matches')}
      items={items}
      label={t('valid-assignments.geo-level-affinity')}
    />
  );
}

function LookupField(props: { label: string; required?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <LookupBoundary
      errorDescription={t('valid-assignments.form.load-error-description')}
      errorTitle={t('valid-assignments.form.load-error-title')}
      {...props}
    />
  );
}
