import { revalidateLogic } from '@tanstack/react-form';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';
import { AuthHeader, AuthPage } from '@/components/auth-card';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { loginSchema } from '@/features/auth/lib/types';
import { useLoginData } from '@/features/auth/store/login-data';
import { useAppName } from '@/lib/app-configuration';
import { safeRedirect } from '@/lib/redirect';

// The page a signed-out user asked for, opened once they sign in.
const loginSearchSchema = z.object({ redirect: z.string().optional().catch(undefined) });

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ search }) => {
    if (useLoginData.getState().isAuthenticated) {
      throw redirect({ href: safeRedirect(search.redirect) });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const appName = useAppName();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { login } = useAuthActions();

  const form = useAppForm({
    defaultValues: {
      username: '',
      password: '',
    },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: loginSchema },
    onSubmit: async ({ value }) => {
      if (await login(value)) {
        await navigate({ href: safeRedirect(search.redirect) });
      }
    },
  });

  return (
    <AuthPage>
      <title>{`${t('login.title')} - ${appName}`}</title>
      <AuthHeader>
        <CardTitle size="lg">{t('login.heading')}</CardTitle>
        <CardDescription>{t('login.subtitle', { appName })}</CardDescription>
      </AuthHeader>

      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          noValidate
        >
          <FieldGroup>
            <form.AppField name="username">
              {(field) => (
                <field.TextField
                  autoComplete="username"
                  label={t('login.username')}
                  placeholder={t('login.username-placeholder')}
                />
              )}
            </form.AppField>

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

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" width="full" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                  )}
                  {isSubmitting ? t('login.submitting') : t('login.submit')}
                </Button>
              )}
            </form.Subscribe>

            <p className="text-center text-sm">
              <Link
                className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                to="/forgot-password"
              >
                {t('login.forgot-password')}
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </AuthPage>
  );
}
