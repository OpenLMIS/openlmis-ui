import { revalidateLogic } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AuthForm, AuthHeader, AuthSubmit, AuthTitle } from '@/components/auth-card';
import { ErrorAlert } from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription } from '@/components/ui/card';
import { requestPasswordReset } from '@/features/auth/api/api';
import { forgotPasswordSchema, passwordResetErrorKey } from '@/features/auth/lib/password-reset';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const request = useMutation({ mutationFn: (email: string) => requestPasswordReset(email) });
  const form = useAppForm({
    defaultValues: { email: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: forgotPasswordSchema },
    onSubmit: ({ value }) => request.mutate(value.email.trim()),
  });

  if (request.isSuccess) return <ResetRequested email={request.variables} />;

  return (
    <>
      <AuthHeader>
        <AuthTitle>{t('forgot-password.title')}</AuthTitle>
        <CardDescription>{t('forgot-password.description')}</CardDescription>
      </AuthHeader>

      <CardContent>
        <AuthForm onSubmit={form.handleSubmit}>
          {request.isError && (
            <ErrorAlert
              description={t(passwordResetErrorKey(request.error))}
              title={t('forgot-password.error-title')}
            />
          )}
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                autoComplete="email"
                dir="ltr"
                label={t('forgot-password.email')}
                placeholder={t('forgot-password.email-placeholder')}
                required
                type="email"
              />
            )}
          </form.AppField>
          <div className="grid gap-2">
            <AuthSubmit pending={request.isPending}>
              {request.isPending ? t('forgot-password.submitting') : t('forgot-password.submit')}
            </AuthSubmit>
            <Button
              nativeButton={false}
              render={<Link to="/login" />}
              variant="outline"
              width="full"
            >
              {t('forgot-password.cancel')}
            </Button>
          </div>
        </AuthForm>
      </CardContent>
    </>
  );
}

/** The same for any address, as the server never says whether one has an account. */
function ResetRequested({ email }: { email: string }) {
  const { t } = useTranslation();
  const descriptionId = useId();

  return (
    <>
      <AuthHeader>
        <AuthTitle focus>{t('forgot-password.sent-title')}</AuthTitle>
        <CardDescription id={descriptionId}>
          <Trans
            components={{ email: <bdi className="font-medium text-foreground" /> }}
            i18nKey="forgot-password.sent-description"
            t={t}
            values={{ email }}
          />
        </CardDescription>
      </AuthHeader>
      <CardContent>
        <Button
          aria-describedby={descriptionId}
          nativeButton={false}
          render={<Link to="/login" />}
          width="full"
        >
          {t('forgot-password.back-to-sign-in')}
        </Button>
      </CardContent>
    </>
  );
}
