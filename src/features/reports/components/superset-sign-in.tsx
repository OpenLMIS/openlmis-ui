import { revalidateLogic } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { isAxiosError, isCancel } from 'axios';
import type { ParseKeys } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';
import { ErrorAlert } from '@/components/display/dialog-parts';
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
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import {
  changeSupersetLanguage,
  checkSupersetSession,
  SupersetAccountMismatchError,
  SupersetSignInError,
  signInToSuperset,
} from '@/features/reports/api/api';
import { DashboardFrame } from '@/features/reports/components/dashboard-frame';
import {
  DashboardArea,
  type DashboardFailure,
  DashboardFailureState,
} from '@/features/reports/components/dashboard-states';
import { isOnline } from '@/lib/online';
import { getSessionScope, SessionEndedError } from '@/lib/session-scope';

type Status =
  | { kind: 'checking' }
  | { kind: 'sign-in' }
  | { kind: 'signed-in' }
  | { kind: 'failed'; failure: DashboardFailure };

const passwordSchema = z.object({
  supersetPassword: z.string().min(1, { message: 'login.password-required' }),
});

function signInErrorKey(error: unknown): ParseKeys {
  if (!(error instanceof SupersetSignInError)) return 'session.sign-in-failed';
  if (error.step === 'authorize') return 'reports.dashboard.sign-in-authorize-failed';
  if (error.step === 'approve') return 'reports.dashboard.sign-in-approve-failed';
  if (!isAxiosError(error.reason)) return 'session.sign-in-failed';
  if (!error.reason.response) return 'session.cannot-connect';
  return error.reason.response.status === 400 ? 'session.wrong-password' : 'session.sign-in-failed';
}

/** One opening of an older reporting stack dashboard: Superset's own session first, as legacy. */
export function SupersetSignIn({
  url,
  supersetUrl,
  title,
  username,
  onRetry,
  restoreFocus,
  placement,
}: {
  url: string;
  supersetUrl: string;
  title: string;
  username: string;
  onRetry: () => void;
  restoreFocus: boolean;
  placement: 'catalog' | 'home';
}) {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [scope] = useState(getSessionScope);
  const home = placement === 'home';
  const [signInRequested, setSignInRequested] = useState(false);
  const signInTrigger = useRef<HTMLButtonElement>(null);
  const signInRequest = useRef<AbortController>(null);

  useEffect(() => {
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && scope === getSessionScope();
    void (async () => {
      try {
        const session = await checkSupersetSession(supersetUrl, username, controller.signal);
        if (!current()) return;
        if (!session.isAuthorized) {
          setStatus({ kind: 'sign-in' });
          return;
        }
        await changeSupersetLanguage(supersetUrl, i18n.language, controller.signal).catch(() => {});
        if (current()) setStatus({ kind: 'signed-in' });
      } catch (error) {
        if (!current() || isCancel(error)) return;
        setStatus({
          kind: 'failed',
          failure:
            error instanceof SupersetAccountMismatchError
              ? { kind: 'account-mismatch', logoutUrl: `${supersetUrl}/logout/` }
              : { kind: isOnline() ? 'unavailable' : 'offline' },
        });
      }
    })();
    return () => {
      controller.abort();
      signInRequest.current?.abort();
    };
  }, [supersetUrl, username, scope, i18n]);

  if (status.kind === 'signed-in')
    return <DashboardFrame url={url} title={title} onRetry={onRetry} restoreFocus={restoreFocus} />;
  if (status.kind === 'failed')
    return (
      <DashboardFailureState
        failure={status.failure}
        onRetry={onRetry}
        focus={restoreFocus}
        hideBackLink={home}
      />
    );
  const needsSignIn = status.kind === 'sign-in';
  const dialogOpen = needsSignIn && (!home || signInRequested);
  return (
    <>
      {home && needsSignIn ? (
        <Alert actionLayout="inline">
          <AlertTitle>{t('reports.dashboard.sign-in-title')}</AlertTitle>
          <AlertDescription>{t('reports.dashboard.sign-in-description')}</AlertDescription>
          <AlertAction>
            <Button ref={signInTrigger} onClick={() => setSignInRequested(true)} type="button">
              {t('reports.dashboard.sign-in-submit')}
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <DashboardArea connecting frame={null} recovery={null} />
      )}
      <FormDialog
        closeButton={false}
        open={dialogOpen}
        finalFocus={home ? () => signInTrigger.current ?? true : undefined}
        onOpenChange={(open) => {
          if (open) return;
          if (home) {
            signInRequest.current?.abort();
            setSignInRequested(false);
          } else void navigate({ to: '/reports' });
        }}
      >
        {dialogOpen && (
          <SignInForm
            username={username}
            signIn={async (password) => {
              const request = new AbortController();
              signInRequest.current = request;
              const { signal } = request;
              try {
                await signInToSuperset({ supersetUrl, username, password, scope, signal });
              } catch (error) {
                if (!(error instanceof SupersetAccountMismatchError)) throw error;
                if (!signal.aborted && scope === getSessionScope()) {
                  setStatus({
                    kind: 'failed',
                    failure: { kind: 'account-mismatch', logoutUrl: `${supersetUrl}/logout/` },
                  });
                }
                return;
              }
              if (signal.aborted || scope !== getSessionScope()) return;
              await changeSupersetLanguage(supersetUrl, i18n.language, signal).catch(() => {});
              if (!signal.aborted && scope === getSessionScope()) setStatus({ kind: 'signed-in' });
            }}
          />
        )}
      </FormDialog>
    </>
  );
}

/** The password stays in this form only, never in a query, mutation, URL or storage. */
function SignInForm({
  username,
  signIn,
}: {
  username: string;
  signIn: (password: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<ParseKeys>();
  const form = useAppForm({
    defaultValues: { supersetPassword: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: passwordSchema },
    onSubmit: async ({ value, formApi }) => {
      setError(undefined);
      try {
        await signIn(value.supersetPassword);
      } catch (failure) {
        if (isCancel(failure) || failure instanceof SessionEndedError) return;
        const key = signInErrorKey(failure);
        if (key === 'session.wrong-password')
          formApi.setFieldValue('supersetPassword', '', { dontValidate: true });
        setError(key);
        document.querySelector<HTMLInputElement>('#supersetPassword')?.focus();
      }
    },
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('reports.dashboard.sign-in-title')}</FormDialogTitle>
        <FormDialogDescription>{t('reports.dashboard.sign-in-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {error && <ErrorAlert description={t(error)} title={t('auth.login-error-title')} />}
          <input autoComplete="username" hidden readOnly value={username} />
          <form.AppField name="supersetPassword">
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
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <>
              <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
              <FormDialogSubmit pending={submitting}>
                {submitting
                  ? t('reports.dashboard.sign-in-pending')
                  : t('reports.dashboard.sign-in-submit')}
              </FormDialogSubmit>
            </>
          )}
        </form.Subscribe>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
