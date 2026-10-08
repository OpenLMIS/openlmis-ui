import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating } from '@tanstack/react-query';
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
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
import { PasswordRequirements } from '@/components/password-requirements';
import { FieldGroup } from '@/components/ui/field';
import { changePassword } from '@/features/profile/api/api';
import { whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';
import { newPasswordSchema } from '@/lib/password-form';
import { passwordErrorKey } from '@/lib/password-rules';
import type { UserRecord } from '@/lib/user-types';

const passwordKey = [...queryKeys.profile.all, 'password'] as const;

type ChangePasswordDialogProps = {
  open: boolean;
  user: UserRecord;
  onClose: () => void;
  /** After the new password is set, e.g. to sign out so it is used at once. */
  onChanged: () => void;
};

export function ChangePasswordDialog({
  open,
  user,
  onClose,
  onChanged,
}: ChangePasswordDialogProps) {
  const { shown, dialogProps } = useDialogTarget(open ? true : undefined, onClose);
  const isSaving = useIsMutating({ mutationKey: passwordKey }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && <ChangePasswordForm onChanged={onChanged} user={user} />}
    </FormDialog>
  );
}

function ChangePasswordForm({
  user,
  onChanged,
}: Pick<ChangePasswordDialogProps, 'user' | 'onChanged'>) {
  const { t } = useTranslation();
  const requirementsId = useId();
  const save = useSessionMutation({
    mutationKey: passwordKey,
    mutationFn: (password: string) => changePassword(user.username, password),
    onSuccess: onChanged,
  });
  const schema = useMemo(() => newPasswordSchema(user), [user]);
  // The server's strength check has a message of ours; its other refusals are shown as sent.
  const errorKey = passwordErrorKey(save.error);
  const form = useAppForm({
    defaultValues: { password: '', confirm: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    // A new password signs the user out, so unsaved changes on the page are asked about first.
    onSubmit: ({ value }) => whenLeaveAllowed(() => save.mutate(value.password)),
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('profile.password.title')}</FormDialogTitle>
        <FormDialogDescription>{t('profile.password.description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && (
            <ErrorAlert
              description={
                errorKey ? t(errorKey) : (serverMessage(save.error) ?? t('users.form.save-error'))
              }
              title={t('profile.password.error-title')}
            />
          )}
          {/* Lets password managers file the new password under the right account. */}
          <input autoComplete="username" hidden readOnly value={user.username} />
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
                  owner={user}
                  password={field.state.value}
                />
              </div>
            )}
          </form.AppField>
          <form.AppField name="confirm">
            {(field) => (
              <field.PasswordField
                hideLabel={t('users.password.hide')}
                label={t('profile.password.confirm')}
                required
                showLabel={t('users.password.show')}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('profile.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>{t('profile.password.submit')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
