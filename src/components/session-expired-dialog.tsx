import { revalidateLogic } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
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
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import * as authApi from '@/features/auth/api/api';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { loginSchema } from '@/features/auth/lib/types';
import { useLoginData } from '@/features/auth/store/login-data';
import { whenLeaveAllowed } from '@/hooks/use-leave-guard';

const passwordSchema = loginSchema.pick({ password: true });

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
  const open = expired && !onLogin && !!username;

  return (
    // The pages behind are waiting on it, so only signing in or out closes it.
    <FormDialog closeButton={false} onOpenChange={() => {}} open={open}>
      {open && <SignInAgainForm username={username} />}
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
    onSuccess: ({ referenceDataUserId, access_token, expires_in }) =>
      setLoginData({
        referenceDataUserId,
        username,
        accessToken: access_token,
        expiresIn: expires_in,
      }),
  });
  const form = useAppForm({
    defaultValues: { password: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: passwordSchema },
    onSubmit: ({ value }) => signIn.mutate(value.password),
  });

  const signOut = () =>
    whenLeaveAllowed(async () => {
      await logout();
      await navigate({ to: '/login' });
    });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
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
          <p className="text-muted-foreground text-sm">{t('session.signed-in-as', { username })}</p>
          {/* Lets password managers offer the password saved for this account. */}
          <input autoComplete="username" hidden readOnly value={username} />
          <form.AppField name="password">
            {(field) => (
              <field.PasswordField
                autoComplete="current-password"
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
        <Button disabled={signIn.isPending} onClick={signOut} type="button" variant="outline">
          {t('session.sign-out')}
        </Button>
        <FormDialogSubmit pending={signIn.isPending}>
          {signIn.isPending ? t('session.signing-in') : t('session.sign-in')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
