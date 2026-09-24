import { revalidateLogic } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import { TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppForm } from '@/components/form/form';
import { ComboboxField } from '@/components/form/form-fields';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FieldGroup } from '@/components/ui/field';
import {
  minimalFacilitiesOptions,
  programsOptions,
  rolesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import type { RightType, Role } from '@/features/reference-data/lib/types';
import { ErrorAlert, FieldSkeleton, RetryButton } from '@/features/users/components/dialog-parts';
import { roleTypeOf } from '@/features/users/lib/role-assignments';
import {
  EMPTY_ROLE_FORM,
  type RoleFormValues,
  roleFormSchema,
  toRoleAssignment,
} from '@/features/users/lib/role-form';
import type { RoleAssignment } from '@/features/users/lib/types';
import { useRightLabel } from '@/features/users/lib/use-right-label';

type AddRoleDialogProps = {
  /** The type of role being added; the dialog is open while it is set. */
  type: RightType | undefined;
  assigned: RoleAssignment[];
  username: string;
  hasHomeFacility: boolean;
  onAdd: (assignment: RoleAssignment) => void;
  onClose: () => void;
};

export function AddRoleDialog({ type, onClose, ...props }: AddRoleDialogProps) {
  const { t } = useTranslation();
  const { shown, dialogProps } = useDialogTarget(type, onClose);

  return (
    <FormDialog {...dialogProps()}>
      {shown && (
        <QueryBoundary
          errorComponent={({ reset }) => (
            <AddRoleFrame type={shown}>
              <OptionsError onRetry={reset} />
            </AddRoleFrame>
          )}
          pendingFallback={
            <AddRoleFrame type={shown}>
              <div aria-busy>
                <FieldGroup>
                  {shown === 'SUPERVISION' && (
                    <FieldSkeleton label={t('users.roles.form.program')} required />
                  )}
                  <FieldSkeleton label={t('users.roles.form.role')} required />
                </FieldGroup>
              </div>
            </AddRoleFrame>
          }
          resetKey={shown}
        >
          <AddRoleForm key={shown} onDone={onClose} type={shown} {...props} />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

function AddRoleHeader({ type }: { type: RightType }) {
  const { t } = useTranslation();
  return (
    <FormDialogHeader>
      <FormDialogTitle>{t('users.roles.form.add-title', { type })}</FormDialogTitle>
      <FormDialogDescription>
        {t('users.roles.form.add-description', { type })}
      </FormDialogDescription>
    </FormDialogHeader>
  );
}

function OptionsError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <ErrorAlert
      action={<RetryButton onClick={onRetry} />}
      description={t('users.roles.error-description')}
      title={t('users.roles.form.options-error-title')}
    />
  );
}

/** The dialog's title and buttons around whatever its body is showing. */
function AddRoleFrame({ type, children }: { type: RightType; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <>
      <AddRoleHeader type={type} />
      <FormDialogBody>{children}</FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('users.roles.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{t('users.roles.form.submit')}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

type AddRoleFormProps = Omit<AddRoleDialogProps, 'type' | 'onClose'> & {
  type: RightType;
  onDone: () => void;
};

function AddRoleForm({
  type,
  assigned,
  username,
  hasHomeFacility,
  onAdd,
  onDone,
}: AddRoleFormProps) {
  const { t } = useTranslation();
  const { data: allRoles } = useSuspenseQuery(rolesOptions());
  const roles = useMemo(
    () => allRoles.filter((role) => roleTypeOf(role) === type).sort(byName),
    [allRoles, type],
  );
  const schema = useMemo(() => roleFormSchema(type, assigned), [type, assigned]);

  const form = useAppForm({
    // A type with a single role has nothing to choose, so it starts chosen.
    defaultValues: {
      ...EMPTY_ROLE_FORM,
      roleId: roles.length === 1 ? (roles[0]?.id ?? null) : null,
    } satisfies RoleFormValues,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => {
      onAdd(toRoleAssignment(type, value));
      onDone();
    },
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <AddRoleHeader type={type} />
      <FormDialogBody>
        <FieldGroup>
          {type === 'SUPERVISION' && (
            <>
              <form.AppField name="programId">{() => <ProgramCombobox />}</form.AppField>
              <form.AppField name="supervisoryNodeId">
                {() => (
                  <SlowField label={t('users.roles.form.node')}>
                    <NodeCombobox />
                  </SlowField>
                )}
              </form.AppField>
            </>
          )}
          {type === 'ORDER_FULFILLMENT' && (
            <form.AppField name="warehouseId">
              {() => (
                <SlowField label={t('users.roles.form.facility')} required>
                  <FacilityCombobox />
                </SlowField>
              )}
            </form.AppField>
          )}
          <form.AppField name="roleId">
            {(field) => <RoleCombobox roleId={field.state.value} roles={roles} />}
          </form.AppField>
          {type === 'SUPERVISION' && !hasHomeFacility && (
            <form.Subscribe selector={(state) => state.values.supervisoryNodeId}>
              {(nodeId) =>
                !nodeId && (
                  <Alert variant="warning">
                    <TriangleAlertIcon />
                    <AlertTitle>{t('users.roles.form.no-home-facility-title')}</AlertTitle>
                    <AlertDescription>
                      {t('users.roles.form.no-home-facility-description', { username })}
                    </AlertDescription>
                  </Alert>
                )
              }
            </form.Subscribe>
          )}
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('users.roles.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit>{t('users.roles.form.submit')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

/** A field whose options take a while, e.g. 500 nodes; the rest of the form works meanwhile. */
function SlowField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <QueryBoundary
      errorComponent={({ reset }) => <OptionsError onRetry={reset} />}
      pendingFallback={<FieldSkeleton label={label} required={required} />}
      resetKey={label}
    >
      {children}
    </QueryBoundary>
  );
}

function ProgramCombobox() {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(programsOptions());
  const items = useMemo(
    () => [...programs].sort(byName).map((program) => ({ value: program.id, label: program.name })),
    [programs],
  );
  return (
    <ComboboxField
      clearLabel={t('users.roles.form.program-clear')}
      emptyMessage={t('users.roles.form.program-empty')}
      items={items}
      label={t('users.roles.form.program')}
      placeholder={t('users.roles.form.program-placeholder')}
      required
    />
  );
}

/** Each node with its facility, as legacy names them, e.g. "FP Approval Point (Balaka)". */
function NodeCombobox() {
  const { t } = useTranslation();
  const { data: nodes } = useSuspenseQuery(supervisoryNodesOptions());
  const { data: facilities } = useSuspenseQuery(minimalFacilitiesOptions());
  const items = useMemo(() => {
    const facilityNames = new Map(facilities.map((facility) => [facility.id, facility.name]));
    return [...nodes].sort(byName).map((node) => {
      const facility = node.facility && facilityNames.get(node.facility.id);
      return { value: node.id, label: facility ? `${node.name} (${facility})` : node.name };
    });
  }, [nodes, facilities]);
  return (
    <ComboboxField
      clearLabel={t('users.roles.form.node-clear')}
      description={t('users.roles.form.node-description', { count: items.length })}
      emptyMessage={t('users.roles.form.node-empty')}
      items={items}
      label={t('users.roles.form.node')}
      placeholder={t('users.roles.form.node-placeholder')}
    />
  );
}

function FacilityCombobox() {
  const { t } = useTranslation();
  const { data: facilities } = useSuspenseQuery(minimalFacilitiesOptions());
  const items = useMemo(
    () =>
      [...facilities].sort(byName).map((facility) => ({
        value: facility.id,
        label: `${facility.code} - ${facility.name}`,
      })),
    [facilities],
  );
  return (
    <ComboboxField
      clearLabel={t('users.roles.form.facility-clear')}
      description={t('users.roles.form.facility-description', { count: items.length })}
      emptyMessage={t('users.roles.form.facility-empty')}
      items={items}
      label={t('users.roles.form.facility')}
      placeholder={t('users.roles.form.facility-placeholder')}
      required
    />
  );
}

/** The roles of this type; once one is picked, the rights it grants show beneath. */
function RoleCombobox({ roles, roleId }: { roles: Role[]; roleId: string | null }) {
  const { t } = useTranslation();
  const rightLabel = useRightLabel();
  const items = useMemo(() => roles.map((role) => ({ value: role.id, label: role.name })), [roles]);
  const rights = roles
    .find((role) => role.id === roleId)
    ?.rights.map((right) => rightLabel(right.name))
    .sort()
    .join(', ');

  return (
    <ComboboxField
      clearLabel={t('users.roles.form.role-clear')}
      description={rights && t('users.roles.form.rights', { rights })}
      emptyMessage={t('users.roles.form.role-empty')}
      items={items}
      label={t('users.roles.form.role')}
      placeholder={t('users.roles.form.role-placeholder')}
      required
    />
  );
}
