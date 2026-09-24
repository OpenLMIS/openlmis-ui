import { revalidateLogic } from '@tanstack/react-form';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAppForm } from '@/components/form/form';
import { ChoiceCard, ComboboxField, SwitchField } from '@/components/form/form-fields';
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
import { Badge } from '@/components/ui/badge';
import { FieldGroup } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { minimalFacilitiesOptions } from '@/features/reference-data/api/queries';
import { createUser, updateUser } from '@/features/users/api/api';
import { userDetailsOptions } from '@/features/users/api/queries';
import {
  DialogLoadError,
  ErrorAlert,
  FieldSkeleton,
  RetryButton,
  SkeletonLine,
  serverMessage,
} from '@/features/users/components/dialog-parts';
import type { UsersSearch } from '@/features/users/lib/search';
import type { UserDetails } from '@/features/users/lib/types';
import {
  countHomeFacilityRoles,
  EMPTY_USER_FORM,
  toAuthUser,
  toContactDetails,
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
  /** Takes over from `onClose` after an add, e.g. to go on to setting a password. */
  onCreated: (userId: string) => void;
};

export function UserFormDialog({ target, onClose, onCreated }: UserFormDialogProps) {
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown ?? 'new') }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown === 'new' && <UserForm onCreated={onCreated} onDone={onClose} />}
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
        <DialogLoadError onRetry={reset} title={t('users.form.edit-title')} />
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

type UserFormProps = {
  details?: UserDetails;
  onDone: () => void;
  onCreated?: (userId: string) => void;
};

function UserForm({ details, onDone, onCreated }: UserFormProps) {
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
      if (details) {
        await updateUser(details, values);
        return details.user.id;
      }
      const user = await createUser(values);
      // Setting a password comes next and needs this user; it is all known now, so it opens without a fetch.
      queryClient.setQueryData(userDetailsOptions(user.id).queryKey, {
        user,
        contact: toContactDetails(user.id, values),
        auth: toAuthUser(user.id, values),
      });
      return user.id;
    },
    onSuccess: (_, values) => {
      const username = values.username.trim();
      toast.success(t(isEdit ? 'users.form.updated-title' : 'users.form.created-title'), {
        description: t(isEdit ? 'users.form.updated' : 'users.form.created', { username }),
      });
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
    onSubmit: ({ value }) =>
      save
        .mutateAsync(value, {
          onSuccess: (userId) => (!isEdit && onCreated ? onCreated(userId) : onDone()),
        })
        .catch(() => undefined),
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
              description={serverMessage(save.error) ?? t('users.form.save-error')}
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

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
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
    <SwitchField
      description={t('users.form.remove-home-facility-roles-description', {
        count,
        facility: facilityName ?? '-',
      })}
      label={t('users.form.remove-home-facility-roles')}
    />
  );
}

function SwitchSkeleton({ label, description }: { label: string; description?: string }) {
  return (
    <ChoiceCard description={description ?? <SkeletonLine width="medium" />} label={label}>
      <div className="h-4.5 w-8 shrink-0">
        <Skeleton fill shape="circle" />
      </div>
    </ChoiceCard>
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
            <SwitchSkeleton
              description={t('users.form.active-description')}
              label={t('users.form.active')}
            />
            <SwitchSkeleton label={t('users.form.allow-notify')} />
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
