import { revalidateLogic } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';
import { ErrorAlert } from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import {
  FormDialog,
  FormDialogBody,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useOfflineSignOut } from '@/components/offline-sign-out';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import * as authApi from '@/features/auth/api/api';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { loginSchema } from '@/features/auth/lib/types';
import { useLoginData } from '@/features/auth/store/login-data';
import { whenLeaveAllowed } from '@/hooks/use-leave-guard';

// Its own field name, so its id never clashes with a password field on the page behind it.
const passwordSchema = z.object({ sessionPassword: loginSchema.shape.password });

function signInErrorKey(error: unknown): ParseKeys {
  if (!isAxiosError(error)) return 'session.sign-in-failed';
  if (!error.response) return 'session.cannot-connect';
  return error.response.status === 400 ? 'session.wrong-password' : 'session.sign-in-failed';
}

/** Over whatever page was open when the server refused the token, until the same user signs in. */
export function SessionExpiredDialog() {
  const expired = useLoginData((state) => state.isAuthenticated && state.expired);
  const username = useLoginData((state) => state.username);
  const onLogin = useRouterState({ select: (state) => state.location.pathname === '/login' });
  // Keeps the last username through the close animation, so the dialog never empties as it fades.
  const { shown, dialogProps } = useDialogTarget(
    expired && !onLogin && username ? username : undefined,
    () => {},
  );

  return (
    // The pages behind are waiting on it, so only signing in or out closes it.
    <FormDialog closeButton={false} {...dialogProps()}>
      {shown && <SignInAgainForm username={shown} />}
    </FormDialog>
  );
}

function SignInAgainForm({ username }: { username: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setLoginData = useLoginData((state) => state.setLoginData);
  const { logout } = useAuthActions();
  const signIn = useMutation({
    mutationFn: (password: string) => authApi.login({ username, password }),
    // Offline, Query would hold these until the network is back; the dialog handles offline itself.
    networkMode: 'always',
    // Back in the field, ready to type again.
    onError: () => {
      const field = document.querySelector<HTMLInputElement>('#sessionPassword');
      field?.focus();
      field?.select();
    },
    onSuccess: (response) => setLoginData(authApi.toLoginData(response)),
  });
  const form = useAppForm({
    defaultValues: { sessionPassword: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: passwordSchema },
    onSubmit: ({ value }) => signIn.mutate(value.sessionPassword),
  });

  const signOut = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      await logout();
      await navigate({ to: '/login' });
    },
  });
  const pending = signIn.isPending || signOut.isPending;
  const offlineSignOut = useOfflineSignOut();
  const cannotConnect = signIn.isError && signInErrorKey(signIn.error) === 'session.cannot-connect';

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      {/* Where a close button would be, so a user who cannot read the dialog can change it. */}
      <div className="absolute top-2 end-2">
        <LanguageSwitcher />
      </div>
      <FormDialogHeader>
        <FormDialogTitle>{t('session.expired-title')}</FormDialogTitle>
        <FormDialogDescription>{t('session.expired-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {signIn.isError && (
            <ErrorAlert
              description={t(signInErrorKey(signIn.error))}
              title={t('auth.login-error-title')}
            />
          )}
          {/* Lets password managers offer the password saved for this account. */}
          <input autoComplete="username" hidden readOnly value={username} />
          <form.AppField name="sessionPassword">
            {(field) => (
              <field.PasswordField
                autoComplete="current-password"
                description={
                  <Trans
                    components={{ user: <span className="font-medium text-foreground" /> }}
                    i18nKey="session.signed-in-as"
                    t={t}
                    values={{ username }}
                  />
                }
                hideLabel={t('login.hide-password')}
                label={t('login.password')}
                placeholder={t('login.password-placeholder')}
                showLabel={t('login.show-password')}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <Button
          disabled={pending}
          onClick={() =>
            offlineSignOut.confirm(() => whenLeaveAllowed(() => signOut.mutate()), cannotConnect)
          }
          type="button"
          variant="destructive"
        >
          {t('session.sign-out')}
        </Button>
        <FormDialogSubmit disabled={signOut.isPending} pending={signIn.isPending}>
          {signIn.isPending ? t('session.signing-in') : t('session.sign-in')}
        </FormDialogSubmit>
      </FormDialogFooter>
      {offlineSignOut.dialog}
    </FormDialogForm>
  );
}
