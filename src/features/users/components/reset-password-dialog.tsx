import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useSuspenseQuery } from '@tanstack/react-query';
import { type ReactNode, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DialogLoadError,
  ErrorAlert,
  SkeletonLine,
  serverMessage,
} from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { ChoiceCard } from '@/components/form/form-fields';
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
import { PasswordRequirements } from '@/components/password-requirements';
import { QueryBoundary } from '@/components/query-boundary';
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { sendPasswordResetEmail, setUserPassword } from '@/features/users/api/api';
import { userDetailsOptions } from '@/features/users/api/queries';
import {
  defaultPasswordForm,
  type PasswordFormValues,
  passwordFormSchema,
  resetEmail,
} from '@/features/users/lib/password-form';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';
import { passwordErrorKey } from '@/lib/password-rules';

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
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: passwordKey(shown?.userId ?? '') }) > 0;
  const title = t(shown?.created ? 'users.password.set-title' : 'users.password.reset-title');

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && (
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <DialogLoadError
              error={error}
              errorTitle={t('users.form.load-error-title')}
              onRetry={reset}
              title={title}
            />
          )}
          pendingFallback={<PasswordFormSkeleton title={title} />}
          resetKey={shown.userId}
        >
          <PasswordForm key={shown.userId} onDone={close} target={shown} title={title} />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

type PasswordFormProps = {
  target: PasswordDialogTarget;
  title: string;
  onDone: () => void;
};

function PasswordForm({ target, title, onDone }: PasswordFormProps) {
  const { t } = useTranslation();
  const requirementsId = useId();
  const { data: details } = useSuspenseQuery(userDetailsOptions(target.userId));
  const { id, username } = details.user;
  const schema = useMemo(() => passwordFormSchema(details.user), [details.user]);
  const email = resetEmail(details.contact?.emailDetails?.email);

  const save = useSessionMutation({
    mutationKey: passwordKey(id),
    mutationFn: async ({ method, password }: PasswordFormValues) => {
      if (method === 'email' && email) await sendPasswordResetEmail(email);
      else await setUserPassword(username, password);
    },
    onSuccess: (_, { method }) => {
      if (method === 'email' && email) {
        toast.success(t('users.password.email-sent-title'), {
          description: t('users.password.email-sent', { email }),
        });
      } else {
        toast.success(t('users.password.password-set-title'), {
          description: t('users.password.password-set', { username }),
        });
      }
    },
  });

  const form = useAppForm({
    defaultValues: defaultPasswordForm(email),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => save.mutateAsync(value, { onSuccess: onDone }).catch(() => undefined),
  });

  const serverError = (error: unknown) => {
    const key = passwordErrorKey(error);
    return key ? t(key) : (serverMessage(error) ?? t('users.form.save-error'));
  };

  const description = target.created
    ? t(email ? 'users.password.set-description-email' : 'users.password.set-description', {
        username,
      })
    : t(email ? 'users.password.reset-description' : 'users.password.reset-description-no-email', {
        username,
      });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <PasswordDialogHeader title={title}>
        <FormDialogDescription>{description}</FormDialogDescription>
      </PasswordDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && (
            <ErrorAlert
              description={serverError(save.error)}
              title={t(
                target.created ? 'users.password.set-error-title' : 'users.password.error-title',
              )}
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
                    <div className="grid gap-3">
                      <field.PasswordField
                        describedBy={requirementsId}
                        hideLabel={t('users.password.hide')}
                        label={t('users.password.new-password')}
                        required
                        showLabel={t('users.password.show')}
                      />
                      <PasswordRequirements
                        id={requirementsId}
                        owner={details.user}
                        password={field.state.value}
                      />
                    </div>
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

function PasswordDialogHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <FormDialogHeader>
      <FormDialogTitle>{title}</FormDialogTitle>
      {children}
    </FormDialogHeader>
  );
}

/** Laid out like the usual case, a user with an email choosing between the two methods. */
function PasswordFormSkeleton({ title }: { title: string }) {
  const { t } = useTranslation();

  return (
    <>
      <PasswordDialogHeader title={title}>
        <SkeletonLine width="short" />
      </PasswordDialogHeader>
      <FormDialogBody>
        <div aria-busy>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">{t('users.password.method')}</FieldLegend>
              {[t('users.password.method-email'), t('users.password.method-manual')].map(
                (label) => (
                  <ChoiceCard
                    description={<SkeletonLine width="medium" />}
                    key={label}
                    label={label}
                  >
                    <div className="size-4 shrink-0">
                      <Skeleton fill shape="circle" />
                    </div>
                  </ChoiceCard>
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
