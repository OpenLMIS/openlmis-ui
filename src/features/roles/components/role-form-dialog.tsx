import { revalidateLogic } from '@tanstack/react-form';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

/** One key per role, so a save still running for one never locks another's dialog. */
const saveKey = (role: string) => [...queryKeys.roles.all, 'save', role] as const;

type RoleFormDialogProps = {
  /** `new` to create a role, or the id of the one being edited; open while set. */
  target: 'new' | string | undefined;
  /** Whether the user may create and edit roles; a link opened without the rights shows No Access. */
  canEdit: boolean;
  onClose: () => void;
  /** After a save, e.g. to reload the signed-in user's rights, which a role they hold may change. */
  onSaved: () => void;
};

export function RoleFormDialog({ target, canEdit, onClose, onSaved }: RoleFormDialogProps) {
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown ?? 'new') }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && !canEdit && <NoAccessContent isNew={shown === 'new'} />}
      {shown && canEdit && <RoleDialogContent onDone={onClose} onSaved={onSaved} target={shown} />}
    </FormDialog>
  );
}

type RoleDialogContentProps = {
  target: string;
  onDone: () => void;
  onSaved: () => void;
};

function RoleDialogContent({ target, onDone, onSaved }: RoleDialogContentProps) {
  const { t } = useTranslation();
  const isNew = target === 'new';
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
      resetKey={target}
    >
      {isNew ? (
        <RoleForm onDone={onDone} onSaved={onSaved} />
      ) : (
        <ExistingRole key={target} onDone={onDone} onSaved={onSaved} roleId={target} />
      )}
    </QueryBoundary>
  );
}

function ExistingRole({ roleId, ...props }: Omit<RoleFormProps, 'role'> & { roleId: string }) {
  const { data: role } = useSuspenseQuery(roleDetailOptions(roleId));
  return <RoleForm role={role} {...props} />;
}

type RoleFormProps = {
  /** The role being edited; none when creating one. */
  role?: Role;
  onDone: () => void;
  onSaved: () => void;
};

function RoleForm({ role, onDone, onSaved }: RoleFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: roles } = useSuspenseQuery(rolesOptions());
  const holders = roles.find((item) => item.id === role?.id)?.count ?? 0;
  const schema = useMemo(() => roleFormSchema(roles, role?.id), [roles, role?.id]);
  const [confirming, setConfirming] = useState<RoleFormValues>();
  // The type of a saved role is fixed, since its holders' assignments are shaped for it.
  const lockedType = roleTypeOf(role);

  const save = useMutation({
    mutationKey: saveKey(role?.id ?? 'new'),
    mutationFn: async (values: RoleFormValues) => {
      const rights = await queryClient.ensureQueryData(rightsByTypeOptions(values.type));
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
    defaultValues: role ? toRoleFormValues(role) : EMPTY_ROLE_FORM,
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
            ? t('roles.form.edit-description', { role: role.name })
            : t('roles.form.create-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        {/* Rights belong to one type, so changing it starts the choice of rights over. */}
        <form.AppField
          listeners={{ onChange: () => form.setFieldValue('rightIds', []) }}
          name="type"
        >
          {(field) => (
            <RoleTypeTabs
              locked={lockedType !== undefined}
              onChange={(type) => field.handleChange(type)}
              type={field.state.value}
            >
              <FieldGroup>
                {save.isError && (
                  <ErrorAlert
                    description={serverMessage(save.error) ?? t('roles.form.save-error')}
                    title={t('roles.form.save-error-title')}
                  />
                )}
                <form.AppField name="name">
                  {(name) => <name.TextField autoComplete="off" label={t('roles.name')} required />}
                </form.AppField>
                <form.AppField name="description">
                  {(description) => (
                    <description.TextareaField label={t('roles.description')} required />
                  )}
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
                      resetKey={field.state.value}
                    >
                      <RightsField type={field.state.value} />
                    </QueryBoundary>
                  )}
                </form.AppField>
              </FieldGroup>
            </RoleTypeTabs>
          )}
        </form.AppField>
      </FormDialogBody>
      <FormDialogFooter>
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

type RoleTypeTabsProps = {
  type: RightType;
  /** Only the current type can be picked, for a saved role. */
  locked: boolean;
  onChange: (type: RightType) => void;
  /** The form below the tabs, as the panel of the chosen type. */
  children: ReactNode;
};

/** The four role types as tabs over the form, each with a line on what it is for. */
function RoleTypeTabs({ type, locked, onChange, children }: RoleTypeTabsProps) {
  const { t } = useTranslation();

  return (
    <Tabs onValueChange={(value) => onChange(value as RightType)} spacing="page" value={type}>
      <div className="flex flex-col gap-2 @container">
        <TabsList aria-label={t('roles.type')} wrap="md">
          {ROLE_TYPES.map((item) => (
            <TabsTrigger disabled={locked && item.type !== type} key={item.type} value={item.type}>
              {t(item.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
        <p className="text-sm text-muted-foreground">{t(roleTypeInfo(type).descriptionKey)}</p>
      </div>
      <TabsContent value={type}>{children}</TabsContent>
    </Tabs>
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
        <div aria-busy className="flex flex-col gap-4">
          <div className="h-8 w-full">
            <Skeleton fill />
          </div>
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
