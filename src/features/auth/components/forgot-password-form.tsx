import { revalidateLogic } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Loader2Icon } from 'lucide-react';
import { useId } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AuthHeader } from '@/components/auth-card';
import { ErrorAlert } from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { requestPasswordReset } from '@/features/auth/api/api';
import { forgotErrorKey, forgotPasswordSchema } from '@/features/auth/lib/password-reset';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const request = useMutation({
    mutationFn: (email: string) => requestPasswordReset(email),
    networkMode: 'always',
  });
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
        <CardTitle size="lg">{t('forgot-password.title')}</CardTitle>
        <CardDescription>{t('forgot-password.description')}</CardDescription>
      </AuthHeader>

      <CardContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            {request.isError && (
              <ErrorAlert
                description={t(forgotErrorKey(request.error))}
                title={t('forgot-password.error-title')}
              />
            )}
            <form.AppField name="email">
              {(field) => (
                <field.TextField
                  autoComplete="email"
                  label={t('forgot-password.email')}
                  placeholder={t('forgot-password.email-placeholder')}
                  required
                  type="email"
                />
              )}
            </form.AppField>
            <div className="grid grid-cols-2 gap-2">
              <Button
                nativeButton={false}
                render={<Link to="/login" />}
                variant="outline"
                width="full"
              >
                {t('forgot-password.cancel')}
              </Button>
              <Button disabled={request.isPending} type="submit" width="full">
                {request.isPending && (
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                )}
                {request.isPending ? t('forgot-password.submitting') : t('forgot-password.submit')}
              </Button>
            </div>
          </FieldGroup>
        </form>
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
        <CardTitle size="lg">{t('forgot-password.sent-title')}</CardTitle>
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
          autoFocus
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
