import { revalidateLogic } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2Icon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AuthHeader } from '@/components/auth-card';
import { ErrorAlert } from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { PasswordRequirements } from '@/components/password-requirements';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { resetPassword } from '@/features/auth/api/api';
import {
  isResetToken,
  type LinkProblem,
  linkProblem,
  resetErrorKey,
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
    networkMode: 'always',
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

  const problem = isResetToken(token) ? linkProblem(reset.error) : 'invalid';
  if (problem) return <LinkNotWorking problem={problem} />;

  return (
    <>
      <AuthHeader>
        <CardTitle size="lg">{t('reset-password.title')}</CardTitle>
        <CardDescription>{t('reset-password.description')}</CardDescription>
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
            {reset.isError && (
              <ErrorAlert
                description={t(resetErrorKey(reset.error))}
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
            <Button disabled={reset.isPending} type="submit" width="full">
              {reset.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
              {reset.isPending ? t('reset-password.submitting') : t('reset-password.submit')}
            </Button>
            <p className="text-center text-sm">
              <Link
                className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                to="/login"
              >
                {t('forgot-password.back-to-sign-in')}
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </>
  );
}

const PROBLEM_TEXT = {
  invalid: ['reset-password.invalid-title', 'reset-password.invalid-description'],
  expired: ['reset-password.expired-title', 'reset-password.expired-description'],
} as const;

function LinkNotWorking({ problem }: { problem: LinkProblem }) {
  const { t } = useTranslation();
  const [title, description] = PROBLEM_TEXT[problem];

  return (
    <>
      <AuthHeader>
        <CardTitle size="lg">{t(title)}</CardTitle>
        <CardDescription>{t(description)}</CardDescription>
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
