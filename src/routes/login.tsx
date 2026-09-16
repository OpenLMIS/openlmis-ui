/* DEMO ONLY - this login screen is a mock for showcasing TanStack Form + Zod + shadcn field primitives. To remove the demo, delete this route file and `src/features/auth/`. */
import { useForm } from '@tanstack/react-form';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { EyeIcon, EyeOffIcon, InfoIcon, Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Logo } from '@/components/logo';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { InvalidCredentialsError, login } from '@/features/auth/api/api';
import { loginSchema } from '@/features/auth/lib/types';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      acceptTerms: false,
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const user = await login(value);
        toast.success(`Welcome back, ${user.name}!`);
        await navigate({ to: '/dashboard' });
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          toast.error(error.message);
        } else {
          toast.error('Something went wrong. Please try again.');
        }
      }
    },
  });

  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center gap-4 bg-muted p-4 dark:bg-background">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
      <Alert className="w-full max-w-sm">
        <InfoIcon />
        <AlertTitle>Demo mode</AlertTitle>
        <AlertDescription>
          The login flow is mocked. Submit any valid credentials or{' '}
          <Button
            type="button"
            variant="link"
            padding="none"
            className="h-auto align-baseline"
            onClick={() => navigate({ to: '/dashboard' })}
          >
            skip to dashboard
          </Button>
          .
        </AlertDescription>
      </Alert>
      <Card className="w-full max-w-sm">
        <CardHeader spacing="tight" className="items-center">
          <Logo className="h-12" />
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
              <form.Field name="email">
                {(field) => {
                  const isInvalid = field.state.meta.errors.length > 0;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="password">
                {(field) => {
                  const isInvalid = field.state.meta.errors.length > 0;
                  return (
                    <Field data-invalid={isInvalid}>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                        <Button
                          type="button"
                          variant="link"
                          weight="normal"
                          padding="none"
                          className="h-auto"
                        >
                          Forgot password?
                        </Button>
                      </div>
                      <InputGroup>
                        <InputGroupInput
                          id={field.name}
                          name={field.name}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="Enter your password"
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
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="acceptTerms">
                {(field) => {
                  const isInvalid = field.state.meta.errors.length > 0;
                  return (
                    <Field orientation="horizontal" data-invalid={isInvalid}>
                      <Checkbox
                        id={field.name}
                        name={field.name}
                        checked={field.state.value}
                        onCheckedChange={(checked) => field.handleChange(checked === true)}
                        aria-invalid={isInvalid}
                      />
                      <FieldContent>
                        <FieldLabel
                          htmlFor={field.name}
                          weight="normal"
                          leading="relaxed"
                          className="!block"
                        >
                          By logging in, I accept the <PolicyLink>Privacy Policy</PolicyLink> and{' '}
                          <PolicyLink>Terms of Service</PolicyLink>.
                        </FieldLabel>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                    </Field>
                  );
                }}
              </form.Field>

              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && (
                      <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    )}
                    Sign in
                  </Button>
                )}
              </form.Subscribe>

              <FieldSeparator surface="card">Or</FieldSeparator>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => toast.info('Mock: would initiate GitHub OAuth.')}
              >
                <GithubMark data-icon="inline-start" />
                Continue with GitHub
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => toast.info('Mock: would initiate Google OAuth.')}
              >
                <GoogleMark data-icon="inline-start" />
                Continue with Google
              </Button>
            </FieldGroup>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Button type="button" variant="link" textSize="sm" padding="none" className="h-auto">
              Sign up
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

type PolicyLinkProps = {
  children: React.ReactNode;
};

function PolicyLink({ children }: PolicyLinkProps) {
  return (
    <Button
      type="button"
      variant="link"
      padding="none"
      className="h-auto"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
    </Button>
  );
}

function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.52 11.52 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576A12.004 12.004 0 0 0 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
