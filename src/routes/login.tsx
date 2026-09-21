import { useForm } from '@tanstack/react-form';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { loginSchema } from '@/features/auth/lib/types';
import { useLoginData } from '@/features/auth/store/login-data';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (useLoginData.getState().isAuthenticated) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthActions();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      username: '',
      password: '',
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      if (await login(value)) {
        await navigate({ to: '/dashboard' });
      }
    },
  });

  const translateErrors = (errors: Array<{ message?: string } | undefined>) =>
    errors.map((error) => ({
      message: error?.message ? t(error.message as ParseKeys) : undefined,
    }));

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
                <form.Field name="username">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>{t('login.username')}</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          autoComplete="username"
                          placeholder={t('login.username-placeholder')}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                        />
                        {isInvalid && (
                          <FieldError errors={translateErrors(field.state.meta.errors)} />
                        )}
                      </Field>
                    );
                  }}
                </form.Field>

                <form.Field name="password">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>{t('login.password')}</FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id={field.name}
                            name={field.name}
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder={t('login.password-placeholder')}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setShowPassword((v) => !v)}
                              aria-label={
                                showPassword ? t('login.hide-password') : t('login.show-password')
                              }
                            >
                              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                            </InputGroupButton>
                          </InputGroupAddon>
                        </InputGroup>
                        {isInvalid && (
                          <FieldError errors={translateErrors(field.state.meta.errors)} />
                        )}
                      </Field>
                    );
                  }}
                </form.Field>

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
