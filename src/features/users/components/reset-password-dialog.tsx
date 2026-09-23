import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { QueryBoundary } from '@/components/query-boundary';
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { sendPasswordResetEmail, setUserPassword } from '@/features/users/api/api';
import { userDetailsOptions } from '@/features/users/api/queries';
import {
  ErrorAlert,
  RetryButton,
  SkeletonLine,
  serverMessage,
} from '@/features/users/components/dialog-parts';
import {
  defaultPasswordForm,
  type PasswordFormValues,
  passwordFormSchema,
} from '@/features/users/lib/password-form';
import type { UserDetails } from '@/features/users/lib/types';
import { queryKeys } from '@/lib/key-factory';

/** The user whose password is set, and whether they were just created and have none yet. */
export type PasswordDialogTarget = {
  userId: string;
  created: boolean;
};

const passwordKey = (userId: string) => [...queryKeys.users.all, 'password', userId] as const;

type ResetPasswordDialogProps = {
  target: PasswordDialogTarget | undefined;
  onClose: () => void;
};

export function ResetPasswordDialog({ target, onClose }: ResetPasswordDialogProps) {
  const { t } = useTranslation();
  const { shown, open, onOpenChangeComplete } = useDialogTarget(target);
  const isSaving = useIsMutating({ mutationKey: passwordKey(shown?.userId ?? '') }) > 0;

  return (
    <FormDialog
      onOpenChange={(next) => {
        if (!next && !isSaving) onClose();
      }}
      onOpenChangeComplete={onOpenChangeComplete}
      open={open}
    >
      {shown && (
        <QueryBoundary
          errorComponent={({ reset }) => (
            <>
              <PasswordDialogHeader created={shown.created} />
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
          pendingFallback={<PasswordFormSkeleton created={shown.created} />}
          resetKey={shown.userId}
        >
          <LoadedPasswordForm key={shown.userId} onDone={onClose} target={shown} />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

type PasswordFormProps = {
  target: PasswordDialogTarget;
  onDone: () => void;
};

function LoadedPasswordForm({ target, onDone }: PasswordFormProps) {
  const { data } = useSuspenseQuery(userDetailsOptions(target.userId));
  return <PasswordForm created={target.created} details={data} onDone={onDone} />;
}

function PasswordDialogHeader({ created, children }: { created: boolean; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <FormDialogHeader>
      <FormDialogTitle>
        {t(created ? 'users.password.set-title' : 'users.password.reset-title')}
      </FormDialogTitle>
      {children}
    </FormDialogHeader>
  );
}

type PasswordFormFieldsProps = {
  details: UserDetails;
  created: boolean;
  onDone: () => void;
};

function PasswordForm({ details, created, onDone }: PasswordFormFieldsProps) {
  const { t } = useTranslation();
  const { id, username } = details.user;
  const email = details.contact?.emailDetails?.email ?? null;

  const save = useMutation({
    mutationKey: passwordKey(id),
    mutationFn: async ({ method, password }: PasswordFormValues) => {
      if (method === 'email' && email) await sendPasswordResetEmail(email);
      else await setUserPassword(username, password);
    },
    onSuccess: (_, { method }) => {
      toast.success(
        method === 'email' && email
          ? t('users.password.email-sent', { email })
          : t('users.password.password-set', { username }),
      );
    },
  });

  const form = useAppForm({
    defaultValues: defaultPasswordForm(email !== null),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: passwordFormSchema },
    onSubmit: ({ value }) => save.mutateAsync(value, { onSuccess: onDone }).catch(() => undefined),
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <PasswordDialogHeader created={created}>
        <FormDialogDescription>
          {created
            ? t('users.password.set-description', { username })
            : email
              ? t('users.password.reset-description', { username })
              : t('users.password.reset-description-no-email', { username })}
        </FormDialogDescription>
      </PasswordDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('users.form.save-error')}
              title={t('users.password.error-title')}
            />
          )}

          {email && (
            <form.AppField name="method">
              {(field) => (
                <field.RadioGroupField
                  label={t('users.password.method')}
                  options={[
                    {
                      value: 'email',
                      label: t('users.password.method-email'),
                      description: t('users.password.method-email-description', { email }),
                    },
                    {
                      value: 'manual',
                      label: t('users.password.method-manual'),
                      description: t('users.password.method-manual-description'),
                    },
                  ]}
                />
              )}
            </form.AppField>
          )}

          <form.Subscribe selector={(state) => state.values.method}>
            {(method) =>
              method === 'manual' && (
                <form.AppField name="password">
                  {(field) => (
                    <field.PasswordField
                      description={t('users.password.requirements')}
                      hideLabel={t('users.password.hide')}
                      label={t('users.password.new-password')}
                      required
                      showLabel={t('users.password.show')}
                    />
                  )}
                </form.AppField>
              )
            }
          </form.Subscribe>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('users.form.cancel')}</FormDialogCancel>
        <form.Subscribe selector={(state) => state.values.method}>
          {(method) => (
            <FormDialogSubmit pending={save.isPending}>
              {t(method === 'email' ? 'users.password.send' : 'users.password.set')}
            </FormDialogSubmit>
          )}
        </form.Subscribe>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

/** Laid out like the usual case, a user with an email choosing between the two methods. */
function PasswordFormSkeleton({ created }: { created: boolean }) {
  const { t } = useTranslation();

  return (
    <>
      <PasswordDialogHeader created={created}>
        <SkeletonLine width="short" />
      </PasswordDialogHeader>
      <FormDialogBody>
        <div aria-busy>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">{t('users.password.method')}</FieldLegend>
              {[t('users.password.method-email'), t('users.password.method-manual')].map(
                (label) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{label}</FieldTitle>
                        <SkeletonLine width="medium" />
                      </FieldContent>
                      <div className="size-4 shrink-0">
                        <Skeleton fill shape="circle" />
                      </div>
                    </Field>
                  </FieldLabel>
                ),
              )}
            </FieldSet>
          </FieldGroup>
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('users.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{t('users.password.send')}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
