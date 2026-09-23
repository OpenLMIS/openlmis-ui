import { revalidateLogic } from '@tanstack/react-form';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AlertCircleIcon, CheckIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAppForm } from '@/components/form/form';
import { CheckboxField, ComboboxField, FieldLabelText } from '@/components/form/form-fields';
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
import { QueryBoundary } from '@/components/query-boundary';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { minimalFacilitiesOptions } from '@/features/reference-data/api/queries';
import { createUser, updateUser } from '@/features/users/api/api';
import { userDetailsOptions } from '@/features/users/api/queries';
import type { UsersSearch } from '@/features/users/lib/search';
import type { UserDetails } from '@/features/users/lib/types';
import {
  countHomeFacilityRoles,
  EMPTY_USER_FORM,
  toUserFormValues,
  type UserFormValues,
  userFormSchema,
} from '@/features/users/lib/user-form';
import { queryKeys } from '@/lib/key-factory';

type DialogTarget = NonNullable<UsersSearch['user']>;

/** One key per user, so a save still running for one user never locks another user's dialog. */
const saveKey = (target: DialogTarget) => [...queryKeys.users.all, 'save', target] as const;

type UserFormDialogProps = {
  target: UsersSearch['user'];
  onClose: () => void;
};

export function UserFormDialog({ target, onClose }: UserFormDialogProps) {
  // Kept through the close animation, so the dialog does not blank out as it fades.
  const [shown, setShown] = useState(target);
  if (target !== undefined && target !== shown) setShown(target);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown ?? 'new') }) > 0;

  return (
    <FormDialog
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setShown(undefined);
      }}
      open={target !== undefined}
    >
      {shown === 'new' && <UserForm onDone={onClose} />}
      {shown !== undefined && shown !== 'new' && (
        <EditUserForm key={shown} onDone={onClose} userId={shown} />
      )}
    </FormDialog>
  );
}

type EditUserFormProps = {
  userId: string;
  onDone: () => void;
};

function EditUserForm({ userId, onDone }: EditUserFormProps) {
  const { t } = useTranslation();

  return (
    <QueryBoundary
      errorComponent={({ reset }) => (
        <>
          <FormDialogHeader>
            <FormDialogTitle>{t('users.form.edit-title')}</FormDialogTitle>
          </FormDialogHeader>
          <ErrorAlert
            action={<RetryButton onClick={reset} />}
            description={t('users.error-description')}
            title={t('users.form.load-error-title')}
          />
          <FormDialogFooter>
            <FormDialogCancel>{t('users.form.cancel')}</FormDialogCancel>
          </FormDialogFooter>
        </>
      )}
      pendingFallback={<UserFormSkeleton />}
      resetKey={userId}
    >
      <LoadedEditUserForm onDone={onDone} userId={userId} />
    </QueryBoundary>
  );
}

function LoadedEditUserForm({ userId, onDone }: EditUserFormProps) {
  const { data } = useSuspenseQuery(userDetailsOptions(userId));
  return <UserForm details={data} onDone={onDone} />;
}

/** The server's own message when it sent one, e.g. that a username is taken. */
function saveErrorMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const message = (error.response?.data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message ? message : undefined;
}

type UserFormProps = {
  details?: UserDetails;
  onDone: () => void;
};

function UserForm({ details, onDone }: UserFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = details !== undefined;
  const savedFacilityId = details?.user.homeFacilityId ?? null;
  const homeFacilityRoles = details ? countHomeFacilityRoles(details.user) : 0;
  const emailVerified = details?.contact?.emailDetails?.emailVerified ?? false;
  const savedEmail = details?.contact?.emailDetails?.email ?? '';

  const save = useMutation({
    mutationKey: saveKey(details?.user.id ?? 'new'),
    mutationFn: async (values: UserFormValues) => {
      if (details) await updateUser(details, values);
      else await createUser(values);
    },
    onSuccess: (_, values) => {
      toast.success(
        t(isEdit ? 'users.form.updated' : 'users.form.created', {
          username: values.username.trim(),
        }),
      );
    },
    // Refreshed either way: a failed edit may already have changed part of the user.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });

  const form = useAppForm({
    defaultValues: details ? toUserFormValues(details) : EMPTY_USER_FORM,
    // Quiet until the first submit, then each field re-checks as it is corrected.
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: userFormSchema },
    // Closing is tied to this call, so a save that ends after the dialog closed cannot close another.
    onSubmit: ({ value }) => save.mutateAsync(value, { onSuccess: onDone }).catch(() => undefined),
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>
          {t(isEdit ? 'users.form.edit-title' : 'users.form.create-title')}
        </FormDialogTitle>
        <FormDialogDescription>
          {isEdit
            ? t('users.form.edit-description', { username: details.user.username })
            : t('users.form.create-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && (
            <ErrorAlert
              description={saveErrorMessage(save.error) ?? t('users.form.save-error')}
              title={t('users.form.save-error-title')}
            />
          )}

          <form.AppField name="username">
            {(field) => <field.TextField autoComplete="off" label={t('users.username')} required />}
          </form.AppField>

          <FieldRow>
            <form.AppField name="firstName">
              {(field) => (
                <field.TextField autoComplete="off" label={t('users.form.first-name')} required />
              )}
            </form.AppField>
            <form.AppField name="lastName">
              {(field) => (
                <field.TextField autoComplete="off" label={t('users.form.last-name')} required />
              )}
            </form.AppField>
          </FieldRow>

          <form.AppField name="email">
            {(field) => (
              <field.TextField
                autoComplete="off"
                description={
                  isEdit &&
                  savedEmail &&
                  field.state.value.trim() === savedEmail && (
                    <EmailStatus verified={emailVerified} />
                  )
                }
                label={t('users.email')}
                type="email"
              />
            )}
          </form.AppField>

          <FieldRow>
            <form.AppField name="jobTitle">
              {(field) => <field.TextField autoComplete="off" label={t('users.form.job-title')} />}
            </form.AppField>
            <form.AppField name="phoneNumber">
              {(field) => (
                <field.TextField
                  autoComplete="off"
                  label={t('users.form.phone-number')}
                  type="tel"
                />
              )}
            </form.AppField>
          </FieldRow>

          <form.AppField name="homeFacilityId">
            {() => (
              <QueryBoundary
                errorComponent={({ reset }) => (
                  <ErrorAlert
                    action={<RetryButton onClick={reset} />}
                    description={t('users.error-description')}
                    title={t('users.form.facilities-error-title')}
                  />
                )}
                pendingFallback={<FieldSkeleton label={t('users.form.home-facility')} />}
                resetKey="facilities"
              >
                <HomeFacilityCombobox />
              </QueryBoundary>
            )}
          </form.AppField>

          {homeFacilityRoles > 0 && (
            <form.Subscribe selector={(state) => state.values.homeFacilityId}>
              {(homeFacilityId) =>
                homeFacilityId !== savedFacilityId && (
                  <form.AppField name="removeHomeFacilityRoles">
                    {() => (
                      <RemoveHomeFacilityRoles
                        count={homeFacilityRoles}
                        facilityId={savedFacilityId}
                      />
                    )}
                  </form.AppField>
                )
              }
            </form.Subscribe>
          )}

          <form.AppField name="active">
            {(field) => (
              <field.CheckboxField
                description={t('users.form.active-description')}
                label={t('users.form.active')}
              />
            )}
          </form.AppField>

          {isEdit && (
            <form.AppField name="allowNotify">
              {(field) => (
                <field.CheckboxField
                  description={
                    emailVerified
                      ? t('users.form.allow-notify-description')
                      : t('users.form.allow-notify-unverified')
                  }
                  disabled={!emailVerified}
                  label={t('users.form.allow-notify')}
                />
              )}
            </form.AppField>
          )}
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('users.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>
          {t(isEdit ? 'users.form.save' : 'users.form.create')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
}

type ErrorAlertProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

function ErrorAlert({ title, description, action }: ErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {action && <AlertAction>{action}</AlertAction>}
    </Alert>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button onClick={onClick} size="sm" type="button" variant="outline">
      {t('error.try-again')}
    </Button>
  );
}

function EmailStatus({ verified }: { verified: boolean }) {
  const { t } = useTranslation();
  return verified ? (
    <Badge variant="success">
      <CheckIcon data-icon="inline-start" />
      {t('users.form.email-verified')}
    </Badge>
  ) : (
    <Badge variant="secondary">{t('users.form.email-unverified')}</Badge>
  );
}

/** Reads its field from the surrounding `AppField`, and the facilities, which may still be loading. */
function HomeFacilityCombobox() {
  const { t } = useTranslation();
  const { data: facilities } = useSuspenseQuery(minimalFacilitiesOptions());
  const items = useMemo(
    () =>
      facilities.map((facility) => ({
        value: facility.id,
        label: `${facility.code} - ${facility.name}`,
      })),
    [facilities],
  );

  return (
    <ComboboxField
      clearLabel={t('users.form.home-facility-clear')}
      emptyMessage={t('users.form.home-facility-empty')}
      items={items}
      label={t('users.form.home-facility')}
      placeholder={t('users.form.home-facility-placeholder')}
    />
  );
}

function RemoveHomeFacilityRoles({
  count,
  facilityId,
}: {
  count: number;
  facilityId: string | null;
}) {
  const { t } = useTranslation();
  const { data: facilityName } = useQuery({
    ...minimalFacilitiesOptions(),
    select: (facilities) => facilities.find((facility) => facility.id === facilityId)?.name,
  });

  return (
    <CheckboxField
      description={t('users.form.remove-home-facility-roles-description', {
        count,
        facility: facilityName ?? '-',
      })}
      label={t('users.form.remove-home-facility-roles')}
    />
  );
}

/** One line of small text: its line height with a bar inside, so it takes the room the text will. */
function SkeletonLine({ width }: { width: 'short' | 'medium' }) {
  return (
    <div className="flex h-4 items-center">
      <div className={width === 'short' ? 'h-3 w-32' : 'h-3 w-56'}>
        <Skeleton fill />
      </div>
    </div>
  );
}

/** The field's real label over a placeholder input, since only the value is still loading. */
function FieldSkeleton({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <Field spacing="tight">
      <FieldLabel>
        <FieldLabelText label={label} required={required} />
      </FieldLabel>
      <div className="h-8 w-full">
        <Skeleton fill />
      </div>
    </Field>
  );
}

function CheckboxSkeleton({ label, description }: { label: string; description?: string }) {
  return (
    <FieldLabel>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>{label}</FieldTitle>
          {description ? (
            <FieldDescription size="sm">{description}</FieldDescription>
          ) : (
            <SkeletonLine width="medium" />
          )}
        </FieldContent>
        <div className="size-4 shrink-0">
          <Skeleton fill />
        </div>
      </Field>
    </FieldLabel>
  );
}

/** The edit form as it will look, laid out the same, so nothing moves when the user arrives. */
function UserFormSkeleton() {
  const { t } = useTranslation();

  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{t('users.form.edit-title')}</FormDialogTitle>
        <SkeletonLine width="short" />
      </FormDialogHeader>
      <FormDialogBody>
        <div aria-busy>
          <FieldGroup>
            <FieldSkeleton label={t('users.username')} required />
            <FieldRow>
              <FieldSkeleton label={t('users.form.first-name')} required />
              <FieldSkeleton label={t('users.form.last-name')} required />
            </FieldRow>
            <FieldSkeleton label={t('users.email')} />
            <FieldRow>
              <FieldSkeleton label={t('users.form.job-title')} />
              <FieldSkeleton label={t('users.form.phone-number')} />
            </FieldRow>
            <FieldSkeleton label={t('users.form.home-facility')} />
            <CheckboxSkeleton
              description={t('users.form.active-description')}
              label={t('users.form.active')}
            />
            <CheckboxSkeleton label={t('users.form.allow-notify')} />
          </FieldGroup>
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('users.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{t('users.form.save')}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
