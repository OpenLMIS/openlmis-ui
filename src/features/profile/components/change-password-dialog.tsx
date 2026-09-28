import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useMutation } from '@tanstack/react-query';
import { useMemo } from 'react';
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
import { FieldGroup } from '@/components/ui/field';
import { changePassword } from '@/features/profile/api/api';
import { changePasswordSchema } from '@/features/profile/lib/password-form';
import type { ProfileUser } from '@/features/profile/lib/types';
import { whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { queryKeys } from '@/lib/key-factory';

const passwordKey = [...queryKeys.profile.all, 'password'] as const;

type ChangePasswordDialogProps = {
  open: boolean;
  user: ProfileUser;
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
  const save = useMutation({
    mutationKey: passwordKey,
    mutationFn: (password: string) => changePassword(user.username, password),
    onSuccess: onChanged,
  });
  const schema = useMemo(
    () => changePasswordSchema([user.username, user.firstName, user.lastName]),
    [user.username, user.firstName, user.lastName],
  );
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
              description={serverMessage(save.error) ?? t('users.form.save-error')}
              title={t('profile.password.error-title')}
            />
          )}
          {/* Lets password managers file the new password under the right account. */}
          <input autoComplete="username" hidden readOnly value={user.username} />
          <form.AppField name="password">
            {(field) => (
              <field.PasswordField
                description={t('password.requirements')}
                hideLabel={t('users.password.hide')}
                label={t('users.password.new-password')}
                required
                showLabel={t('users.password.show')}
              />
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
