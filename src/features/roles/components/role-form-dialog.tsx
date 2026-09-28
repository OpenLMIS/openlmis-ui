import { revalidateLogic } from '@tanstack/react-form';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeftIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  DialogLoadError,
  ErrorAlert,
  FieldSkeleton,
  RetryButton,
  SkeletonLine,
  serverMessage,
} from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { useFieldContext } from '@/components/form/form-context';
import { MultiComboboxField } from '@/components/form/form-fields';
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
import { NoAccess } from '@/components/no-access-page';
import { QueryBoundary } from '@/components/query-boundary';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { rolesOptions } from '@/features/reference-data/api/queries';
import { ROLE_TYPES, roleTypeInfo, roleTypeOf } from '@/features/reference-data/lib/roles';
import type { RightType, Role } from '@/features/reference-data/lib/types';
import { useRightLabel } from '@/features/reference-data/lib/use-right-label';
import { createRole, updateRole } from '@/features/roles/api/api';
import { rightsByTypeOptions, roleDetailOptions } from '@/features/roles/api/queries';
import {
  asksBeforeSaving,
  EMPTY_ROLE_FORM,
  type RoleFormValues,
  roleFormSchema,
  toRoleBody,
  toRoleFormValues,
} from '@/features/roles/lib/role-form';
import { queryKeys } from '@/lib/key-factory';

/** The open dialog: a new role or the id of one, and the type picked for it once past the first step. */
export type RoleDialogTarget = {
  role: 'new' | string;
  roleType: RightType | undefined;
};

/** One key per role, so a save still running for one never locks another's dialog. */
const saveKey = (role: string) => [...queryKeys.roles.all, 'save', role] as const;

type RoleFormDialogProps = {
  target: RoleDialogTarget | undefined;
  /** Whether the user may create and edit roles; a link opened without the rights shows No Access. */
  canEdit: boolean;
  onClose: () => void;
  onPickType: (type: RightType) => void;
  onBackToTypes: () => void;
  /** After a save, e.g. to reload the signed-in user's rights, which a role they hold may change. */
  onSaved: () => void;
};

export function RoleFormDialog({ target, canEdit, onClose, ...steps }: RoleFormDialogProps) {
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown?.role ?? 'new') }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && !canEdit && <NoAccessContent isNew={shown.role === 'new'} />}
      {shown && canEdit && <RoleDialogContent onDone={onClose} target={shown} {...steps} />}
    </FormDialog>
  );
}

type RoleDialogContentProps = Omit<RoleFormDialogProps, 'target' | 'canEdit' | 'onClose'> & {
  target: RoleDialogTarget;
  onDone: () => void;
};

function RoleDialogContent({ target, ...props }: RoleDialogContentProps) {
  const { t } = useTranslation();
  const isNew = target.role === 'new';
  const title = t(isNew ? 'roles.form.create-title' : 'roles.form.edit-title');

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isAxiosError(error) && error.response?.status === 404 ? (
          <NotFoundContent title={title} />
        ) : (
          <DialogLoadError
            errorTitle={t('roles.form.load-error-title')}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={
        <RoleFormSkeleton
          submitLabel={t(isNew ? 'roles.form.create' : 'roles.form.save')}
          title={title}
        />
      }
      resetKey={target.role}
    >
      {isNew ? (
        <NewRole target={target} {...props} />
      ) : (
        <ExistingRole key={target.role} roleId={target.role} target={target} {...props} />
      )}
    </QueryBoundary>
  );
}

function NewRole({ target, onPickType, onBackToTypes, onDone, onSaved }: RoleDialogContentProps) {
  return target.roleType ? (
    <RoleForm
      key={target.roleType}
      onBack={onBackToTypes}
      onDone={onDone}
      onSaved={onSaved}
      type={target.roleType}
    />
  ) : (
    <TypeStep onPick={onPickType} />
  );
}

function ExistingRole({
  roleId,
  target,
  onPickType,
  onBackToTypes,
  onDone,
  onSaved,
}: RoleDialogContentProps & { roleId: string }) {
  const { data: role } = useSuspenseQuery(roleDetailOptions(roleId));
  // A role saved without rights has no type yet, so it is asked for first, as legacy does.
  const savedType = roleTypeOf(role);
  const type = savedType ?? target.roleType;
  if (!type) return <TypeStep existing onPick={onPickType} />;
  return (
    <RoleForm
      key={type}
      onBack={savedType ? undefined : onBackToTypes}
      onDone={onDone}
      onSaved={onSaved}
      role={role}
      type={type}
    />
  );
}

const typeStepSchema = z.object({ type: z.string().min(1, 'roles.form.type-required') });

function TypeStep({
  existing = false,
  onPick,
}: {
  existing?: boolean;
  onPick: (type: RightType) => void;
}) {
  const { t } = useTranslation();
  const form = useAppForm({
    defaultValues: { type: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: typeStepSchema },
    onSubmit: ({ value }) => onPick(value.type as RightType),
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>
          {t(existing ? 'roles.form.edit-title' : 'roles.form.create-title')}
        </FormDialogTitle>
        <FormDialogDescription>
          {t(existing ? 'roles.form.type-description-existing' : 'roles.form.type-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <form.AppField name="type">
            {(field) => (
              <field.RadioGroupField
                label={t('roles.type')}
                options={ROLE_TYPES.map((item) => ({
                  value: item.type,
                  label: t(item.labelKey),
                  description: t(item.descriptionKey),
                }))}
                required
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('roles.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit>{t('roles.form.continue')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

type RoleFormProps = {
  /** The role being edited; none when creating one. */
  role?: Role;
  type: RightType;
  /** Returns to the type step; only while the type is still open to choose. */
  onBack?: () => void;
  onDone: () => void;
  onSaved: () => void;
};

function RoleForm({ role, type, onBack, onDone, onSaved }: RoleFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: roles } = useSuspenseQuery(rolesOptions());
  const holders = roles.find((item) => item.id === role?.id)?.count ?? 0;
  const schema = useMemo(() => roleFormSchema(roles, role?.id), [roles, role?.id]);
  const [confirming, setConfirming] = useState<RoleFormValues>();
  const typeLabel = t(roleTypeInfo(type).labelKey);

  const save = useMutation({
    mutationKey: saveKey(role?.id ?? 'new'),
    mutationFn: async (values: RoleFormValues) => {
      const rights = await queryClient.ensureQueryData(rightsByTypeOptions(type));
      const body = toRoleBody(values, rights, role?.id);
      return role ? updateRole(role.id, body) : createRole(body);
    },
    onSuccess: (saved) => {
      if (role) {
        toast.success(t('roles.form.updated-title'), {
          description: t('roles.form.updated', { role: saved.name, count: holders }),
        });
      } else {
        toast.success(t('roles.form.created-title'), {
          description: t('roles.form.created', { role: saved.name }),
        });
      }
      onSaved();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.all }),
  });

  const submit = (values: RoleFormValues) =>
    save.mutateAsync(values, { onSuccess: onDone }).catch(() => undefined);

  const form = useAppForm({
    defaultValues: role ? toRoleFormValues(role, type) : EMPTY_ROLE_FORM,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) =>
      asksBeforeSaving(role, holders) ? setConfirming(value) : submit(value),
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>
          {t(role ? 'roles.form.edit-title' : 'roles.form.create-title')}
        </FormDialogTitle>
        <FormDialogDescription>
          {role
            ? t('roles.form.edit-description', { role: role.name, type: typeLabel })
            : t('roles.form.create-description', { type: typeLabel })}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('roles.form.save-error')}
              title={t('roles.form.save-error-title')}
            />
          )}
          <form.AppField name="name">
            {(field) => <field.TextField autoComplete="off" label={t('roles.name')} required />}
          </form.AppField>
          <form.AppField name="description">
            {(field) => <field.TextareaField label={t('roles.description')} required />}
          </form.AppField>
          <form.AppField name="rightIds">
            {() => (
              <QueryBoundary
                errorComponent={({ reset }) => (
                  <ErrorAlert
                    action={<RetryButton onClick={reset} />}
                    description={t('error.check-connection')}
                    title={t('roles.form.rights-error-title')}
                  />
                )}
                pendingFallback={<FieldSkeleton label={t('roles.rights')} required />}
                resetKey={type}
              >
                <RightsField type={type} />
              </QueryBoundary>
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        {onBack && (
          <div className="w-full sm:me-auto sm:w-auto">
            <Button
              disabled={save.isPending}
              onClick={onBack}
              type="button"
              variant="ghost"
              width="full"
            >
              <ArrowLeftIcon className="rtl:rotate-180" data-icon="inline-start" />
              {t('roles.form.back')}
            </Button>
          </div>
        )}
        <FormDialogCancel disabled={save.isPending}>{t('roles.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>
          {t(role ? 'roles.form.save' : 'roles.form.create')}
        </FormDialogSubmit>
      </FormDialogFooter>
      <AlertDialog
        onOpenChange={(open) => !open && setConfirming(undefined)}
        open={Boolean(confirming)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('roles.confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('roles.confirm.description', { count: holders, role: role?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('roles.form.cancel')}</AlertDialogCancel>
            <Button
              onClick={() => {
                if (confirming) void submit(confirming);
                setConfirming(undefined);
              }}
            >
              {t('roles.form.save')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormDialogForm>
  );
}

/** Reads its field from the surrounding `AppField`, and the type's rights, which may still be loading. */
function RightsField({ type }: { type: RightType }) {
  const { t } = useTranslation();
  const rightLabel = useRightLabel();
  const { data: rights } = useSuspenseQuery(rightsByTypeOptions(type));
  const items = useMemo(
    () =>
      rights
        .map((right) => ({ value: right.id, label: rightLabel(right.name) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [rights, rightLabel],
  );

  const value = useFieldContext<string[]>().state.value;
  const selected = items.filter((item) => value.includes(item.value)).length;

  return (
    <MultiComboboxField
      description={t('roles.form.rights-selected', { count: selected, total: items.length })}
      emptyMessage={t('roles.form.rights-empty')}
      items={items}
      label={t('roles.rights')}
      placeholder={t('roles.form.rights-placeholder')}
      removeLabel={(label) => t('roles.form.remove-right', { right: label })}
      required
    />
  );
}

function NoAccessContent({ isNew }: { isNew: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>
          {t(isNew ? 'roles.form.create-title' : 'roles.form.edit-title')}
        </FormDialogTitle>
      </FormDialogHeader>
      <NoAccess />
      <FormDialogFooter>
        <FormDialogCancel>{t('roles.form.close')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}

function NotFoundContent({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <FormDialogDescription>{t('roles.form.not-found')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogFooter>
        <FormDialogCancel>{t('roles.form.close')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}

/** Laid out like the form, so nothing moves when the role arrives. */
function RoleFormSkeleton({ title, submitLabel }: { title: string; submitLabel: string }) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <SkeletonLine width="medium" />
      </FormDialogHeader>
      <FormDialogBody>
        <div aria-busy>
          <FieldGroup>
            <FieldSkeleton label={t('roles.name')} required />
            <FieldSkeleton label={t('roles.description')} required />
            <FieldSkeleton label={t('roles.rights')} required />
          </FieldGroup>
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('roles.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{submitLabel}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
