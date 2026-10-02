import { revalidateLogic, useStore } from '@tanstack/react-form';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { BuildingIcon, UsersIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, FieldSkeleton, serverMessage } from '@/components/dialog-parts';
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
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
import { FieldGroup } from '@/components/ui/field';
import {
  type AssignmentFormValues,
  assignmentFormSchema,
  EMPTY_ASSIGNMENT_FORM,
  toAssignmentBody,
} from '@/components/valid-assignments/assignment-form';
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
  /** Whether the user may list organizations; without it the node is always a facility. */
  canPickOrganizations: boolean;
};

const saveKey = (api: AssignmentsApi) => [...api.queryKey, 'create'];

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
        type: queryClient
          .getQueryData(facilityTypesOptions({ active: true }).queryKey)
          ?.find((type) => type.id === assignment.facilityTypeId)?.name,
        program: queryClient
          .getQueryData(programsOptions().queryKey)
          ?.find((program) => program.id === assignment.programId)?.name,
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
            <form.AppField name="programId">
              {(field) => (
                <ProgramItems>
                  {(items) => (
                    <field.SelectField
                      items={items}
                      label={t('valid-assignments.program')}
                      required
                    />
                  )}
                </ProgramItems>
              )}
            </form.AppField>
          </LookupField>
          <LookupField label={t('valid-assignments.facility-type')} required>
            <form.AppField name="facilityTypeId">
              {(field) => (
                <FacilityTypeItems>
                  {(items) => (
                    <field.SelectField
                      items={items}
                      label={t('valid-assignments.facility-type')}
                      required
                    />
                  )}
                </FacilityTypeItems>
              )}
            </form.AppField>
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
              <form.AppField name="organizationId">
                {(field) => (
                  <OrganizationItems>
                    {(items) => (
                      <field.SelectField
                        items={items}
                        label={t('valid-assignments.organization')}
                        required
                      />
                    )}
                  </OrganizationItems>
                )}
              </form.AppField>
            </LookupField>
          ) : (
            <LookupField label={t('valid-assignments.facility')} required>
              <form.AppField name="facilityId">
                {(field) => (
                  <FacilityItems>
                    {(items) => (
                      <field.ComboboxField
                        clearLabel={t('valid-assignments.form.clear-facility')}
                        emptyMessage={t('data-table.no-matches')}
                        items={items}
                        label={t('valid-assignments.facility')}
                        required
                      />
                    )}
                  </FacilityItems>
                )}
              </form.AppField>
            </LookupField>
          )}
          <LookupField label={t('valid-assignments.geo-level-affinity')}>
            <form.AppField name="geoLevelAffinityId">
              {(field) => (
                <GeoLevelItems>
                  {(items) => (
                    <field.ComboboxField
                      clearLabel={t('valid-assignments.form.clear-geo-level-affinity')}
                      description={t('valid-assignments.form.geo-level-affinity-description')}
                      emptyMessage={t('data-table.no-matches')}
                      items={items}
                      label={t('valid-assignments.geo-level-affinity')}
                    />
                  )}
                </GeoLevelItems>
              )}
            </form.AppField>
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

type Item = { value: string; label: string; description?: string };
type ItemsProps = { children: (items: Item[]) => ReactNode };

function ProgramItems({ children }: ItemsProps) {
  const { data } = useSuspenseQuery(programsOptions());
  return children(
    data.map((program) => ({ value: program.id, label: program.name ?? program.code })),
  );
}

function FacilityTypeItems({ children }: ItemsProps) {
  const { data } = useSuspenseQuery(facilityTypesOptions({ active: true }));
  return children(data.map((type) => ({ value: type.id, label: type.name ?? type.code })));
}

function FacilityItems({ children }: ItemsProps) {
  const { data } = useSuspenseQuery(minimalFacilitiesOptions());
  return children(
    data.map((facility) => ({
      value: facility.id,
      label: facility.name,
      description: facility.code,
    })),
  );
}

function OrganizationItems({ children }: ItemsProps) {
  const { data } = useSuspenseQuery(organizationsOptions());
  return children(
    data.map((organization) => ({ value: organization.id, label: organization.name })),
  );
}

function GeoLevelItems({ children }: ItemsProps) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(geographicLevelsOptions());
  return children(
    data.map((level) => ({
      value: level.id,
      label: level.name ?? level.code,
      description: t('valid-assignments.form.level', { level: level.levelNumber }),
    })),
  );
}

/** Each picker loads on its own, so the dialog never waits for the slowest list. */
function LookupField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) => (
        <LoadError
          description={t('valid-assignments.form.load-error-description')}
          error={error}
          reset={reset}
          title={t('valid-assignments.form.load-error-title')}
        />
      )}
      pendingFallback={<FieldSkeleton label={label} required={required} />}
      resetKey={label}
    >
      {children}
    </QueryBoundary>
  );
}
