import { revalidateLogic } from '@tanstack/react-form';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppForm } from '@/components/form/form';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Logo } from '@/components/logo';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { loginSchema } from '@/features/auth/lib/types';
import { useLoginData } from '@/features/auth/store/login-data';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (useLoginData.getState().isAuthenticated) {
      throw redirect({ to: '/home' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
        await navigate({ to: '/home' });
      }
    },
  });

  return (
    <section className="relative flex min-h-svh w-full flex-col items-center justify-center bg-muted px-6 py-12 text-foreground dark:bg-background">
      <title>{`${t('login.title')} - OpenLMIS UI`}</title>

      <div className="absolute top-4 end-4 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <div className="w-full max-w-sm">
        <Card>
          <CardHeader align="center">
            <Logo className="mx-auto h-12" />
            <CardTitle size="lg">{t('login.heading')}</CardTitle>
            <CardDescription>{t('login.subtitle')}</CardDescription>
          </CardHeader>

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
              </FieldGroup>
            </form>
          </CardContent>

          <CardFooter align="center">
            <p className="text-muted-foreground text-sm">
              {t('login.powered-by')}{' '}
              <a
                className="underline underline-offset-4 hover:text-primary"
                href="https://openlmis.org/"
                rel="noopener noreferrer"
                target="_blank"
              >
                OpenLMIS
              </a>
              .
            </p>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
