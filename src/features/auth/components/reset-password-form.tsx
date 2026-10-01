import { revalidateLogic } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AuthForm, AuthHeader, AuthLink, AuthSubmit, AuthTitle } from '@/components/auth-card';
import { ErrorAlert } from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { PasswordRequirements } from '@/components/password-requirements';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription } from '@/components/ui/card';
import { resetPassword } from '@/features/auth/api/api';
import {
  isResetToken,
  type LinkProblem,
  linkProblem,
  passwordResetErrorKey,
} from '@/features/auth/lib/password-reset';
import { newPasswordSchema } from '@/lib/password-form';

// The link does not say whose password it is, so the names rule is left out.
const schema = newPasswordSchema();

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const requirementsId = useId();
  const [visible, setVisible] = useState(false);
  const reset = useMutation({
    mutationFn: (password: string) => resetPassword(token, password),
    onSuccess: async () => {
      toast.success(t('profile.password.changed-title'), {
        description: t('profile.password.changed'),
      });
      await navigate({ to: '/login' });
    },
  });
  const form = useAppForm({
    defaultValues: { password: '', confirm: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => reset.mutate(value.password),
  });

  if (!isResetToken(token)) return <LinkNotWorking problem="invalid" />;
  const problem = linkProblem(reset.error);
  if (problem) return <LinkNotWorking focus problem={problem} />;

  return (
    <>
      <AuthHeader>
        <AuthTitle>{t('reset-password.title')}</AuthTitle>
        <CardDescription>{t('reset-password.description')}</CardDescription>
      </AuthHeader>

      <CardContent>
        <AuthForm onSubmit={form.handleSubmit}>
          {reset.isError && (
            <ErrorAlert
              description={t(passwordResetErrorKey(reset.error))}
              title={t('profile.password.error-title')}
            />
          )}
          <form.AppField name="password">
            {(field) => (
              <div className="grid gap-3">
                <field.PasswordField
                  describedBy={requirementsId}
                  hideLabel={t('users.password.hide')}
                  label={t('users.password.new-password')}
                  onVisibleChange={setVisible}
                  required
                  showLabel={t('users.password.show')}
                  visible={visible}
                />
                <PasswordRequirements id={requirementsId} password={field.state.value} />
              </div>
            )}
          </form.AppField>
          <form.AppField name="confirm">
            {(field) => (
              <field.PasswordField
                hideLabel={t('users.password.hide')}
                label={t('profile.password.confirm')}
                onVisibleChange={setVisible}
                required
                showLabel={t('users.password.show')}
                visible={visible}
              />
            )}
          </form.AppField>
          <AuthSubmit pending={reset.isPending}>
            {reset.isPending ? t('reset-password.submitting') : t('reset-password.submit')}
          </AuthSubmit>
          <p className="text-center">
            <AuthLink to="/login">{t('forgot-password.back-to-sign-in')}</AuthLink>
          </p>
        </AuthForm>
      </CardContent>
    </>
  );
}

function LinkNotWorking({ problem, focus = false }: { problem: LinkProblem; focus?: boolean }) {
  const { t } = useTranslation();

  return (
    <>
      <AuthHeader>
        <AuthTitle focus={focus}>{t(`reset-password.${problem}-title`)}</AuthTitle>
        <CardDescription>{t(`reset-password.${problem}-description`)}</CardDescription>
      </AuthHeader>
      <CardContent>
        <div className="grid gap-2">
          <Button nativeButton={false} render={<Link to="/forgot-password" />} width="full">
            {t('reset-password.request-new-link')}
          </Button>
          <Button nativeButton={false} render={<Link to="/login" />} variant="outline" width="full">
            {t('forgot-password.back-to-sign-in')}
          </Button>
        </div>
      </CardContent>
    </>
  );
}
