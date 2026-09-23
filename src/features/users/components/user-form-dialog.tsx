import { revalidateLogic } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AlertCircleIcon, CheckIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAppForm } from '@/components/form/form';
import { ComboboxField } from '@/components/form/form-fields';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
} from '@/components/form-dialog/form-dialog';
import { QueryBoundary } from '@/components/query-boundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { minimalFacilitiesOptions } from '@/features/facilities/api/queries';
import { createUser, updateUser } from '@/features/users/api/api';
import { userDetailsOptions } from '@/features/users/api/queries';
import type { UserDetails } from '@/features/users/lib/types';
import {
  countHomeFacilityRoles,
  EMPTY_USER_FORM,
  toUserFormValues,
  type UserFormValues,
  userFormSchema,
} from '@/features/users/lib/user-form';
import { queryKeys } from '@/lib/key-factory';

/** `new` to add a user, a user id to edit one, or nothing when closed. */
export type UserDialogTarget = 'new' | (string & {});

type UserFormDialogProps = {
  target: UserDialogTarget | undefined;
  onClose: () => void;
};

export function UserFormDialog({ target, onClose }: UserFormDialogProps) {
  // Kept through the close animation, so the dialog does not blank out as it fades.
  const [shown, setShown] = useState(target);
  if (target !== undefined && target !== shown) setShown(target);
  const [isSaving, setIsSaving] = useState(false);

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
      {shown === 'new' && <UserForm onDone={onClose} onSavingChange={setIsSaving} />}
      {shown !== undefined && shown !== 'new' && (
        <EditUserForm key={shown} onDone={onClose} onSavingChange={setIsSaving} userId={shown} />
      )}
    </FormDialog>
  );
}

type UserFormProps = {
  details?: UserDetails;
  onDone: () => void;
  onSavingChange: (isSaving: boolean) => void;
};

function EditUserForm({ userId, ...props }: Omit<UserFormProps, 'details'> & { userId: string }) {
  const { t } = useTranslation();

  return (
    <QueryBoundary
      errorComponent={({ reset }) => (
        <>
          <FormDialogHeader title={t('users.form.edit-title')} />
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{t('users.form.load-error-title')}</AlertTitle>
            <AlertDescription>{t('users.form.load-error')}</AlertDescription>
          </Alert>
          <FormDialogFooter>
            <FormDialogCancel>{t('users.form.cancel')}</FormDialogCancel>
            <Button onClick={reset} type="button">
              {t('users.form.retry')}
            </Button>
          </FormDialogFooter>
        </>
      )}
      pendingFallback={<UserFormSkeleton />}
      resetKey={userId}
    >
      <LoadedEditUserForm userId={userId} {...props} />
    </QueryBoundary>
  );
}

function LoadedEditUserForm({
  userId,
  ...props
}: Omit<UserFormProps, 'details'> & { userId: string }) {
  const { data } = useSuspenseQuery(userDetailsOptions(userId));
  return <UserForm details={data} {...props} />;
}

/** The server's own message when it sent one, e.g. that a username is taken. */
function saveErrorMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const message = (error.response?.data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message ? message : undefined;
}

function UserForm({ details, onDone, onSavingChange }: UserFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = details !== undefined;
  const homeFacilityRoles = details ? countHomeFacilityRoles(details.user) : 0;
  const emailVerified = details?.contact?.emailDetails?.emailVerified ?? false;
  const savedEmail = details?.contact?.emailDetails?.email ?? '';
  const { data: facilities } = useQuery(minimalFacilitiesOptions());
  const previousFacilityName = facilities?.find(
    (facility) => facility.id === details?.user.homeFacilityId,
  )?.name;

  const save = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (details) await updateUser(details, values);
      else await createUser(values);
    },
    onMutate: () => onSavingChange(true),
    onSettled: () => onSavingChange(false),
    onSuccess: async (_, values) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success(
        t(isEdit ? 'users.form.updated' : 'users.form.created', {
          username: values.username.trim(),
        }),
      );
      onDone();
    },
  });

  const form = useAppForm({
    defaultValues: details ? toUserFormValues(details) : EMPTY_USER_FORM,
    // Quiet until the first submit, then each field re-checks as it is corrected.
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: userFormSchema },
    onSubmit: ({ value }) => save.mutateAsync(value).catch(() => undefined),
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader
        description={
          isEdit
            ? t('users.form.edit-description', { username: details.user.username })
            : t('users.form.create-description')
        }
        title={t(isEdit ? 'users.form.edit-title' : 'users.form.create-title')}
      />
      <FormDialogBody>
        <FieldGroup>
          {save.isError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{t('users.form.save-error-title')}</AlertTitle>
              <AlertDescription>
                {saveErrorMessage(save.error) ?? t('users.form.save-error')}
              </AlertDescription>
            </Alert>
          )}

          <form.AppField name="username">
            {(field) => <field.TextField autoComplete="off" label={t('users.username')} required />}
          </form.AppField>

          <div className="grid gap-5 sm:grid-cols-2">
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
          </div>

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

          <div className="grid gap-5 sm:grid-cols-2">
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
          </div>

          <form.AppField name="homeFacilityId">
            {() => (
              <QueryBoundary
                errorComponent={() => <FacilitiesError />}
                pendingFallback={<FieldSkeleton />}
                resetKey="facilities"
              >
                <HomeFacilityCombobox />
              </QueryBoundary>
            )}
          </form.AppField>

          {isEdit && homeFacilityRoles > 0 && (
            <form.Subscribe selector={(state) => state.values.homeFacilityId}>
              {(homeFacilityId) =>
                homeFacilityId !== (details.user.homeFacilityId ?? null) && (
                  <form.AppField name="removeHomeFacilityRoles">
                    {(field) => (
                      <field.CheckboxField
                        description={t('users.form.remove-home-facility-roles-description', {
                          count: homeFacilityRoles,
                          facility: previousFacilityName ?? '-',
                        })}
                        label={t('users.form.remove-home-facility-roles')}
                      />
                    )}
                  </form.AppField>
                )
              }
            </form.Subscribe>
          )}

          <form.AppField name="active">
            {(field) => (
              <field.SwitchField
                description={t('users.form.active-description')}
                label={t('users.form.active')}
              />
            )}
          </form.AppField>

          {isEdit && (
            <form.AppField name="allowNotify">
              {(field) => (
                <field.SwitchField
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

function FacilitiesError() {
  const { t } = useTranslation();
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{t('users.form.home-facility')}</AlertTitle>
      <AlertDescription>{t('users.form.load-error')}</AlertDescription>
    </Alert>
  );
}

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-4 w-24">
        <Skeleton fill />
      </div>
      <div className="h-8 w-full">
        <Skeleton fill />
      </div>
    </div>
  );
}

function UserFormSkeleton() {
  const { t } = useTranslation();

  return (
    <>
      <FormDialogHeader title={t('users.form.edit-title')} />
      <FormDialogBody>
        <div aria-busy className="flex flex-col gap-5">
          {Array.from({ length: 5 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders with nothing else to key on.
            <FieldSkeleton key={index} />
          ))}
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('users.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{t('users.form.save')}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
