import { Link } from '@tanstack/react-router';
import { Loader2Icon } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Logo } from '@/components/logo';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useAppName } from '@/lib/app-configuration';

export function AuthPage({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const appName = useAppName();

  return (
    <section className="relative flex min-h-svh w-full flex-col items-center justify-center bg-muted px-6 py-12 text-foreground dark:bg-background">
      <title>{`${title} - ${appName}`}</title>
      <div className="absolute top-4 end-4 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <div className="w-full max-w-sm">
        <Card>
          {children}
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

export function AuthHeader({ children }: { children: ReactNode }) {
  return (
    <CardHeader align="center">
      <Logo className="mx-auto h-12" />
      {children}
    </CardHeader>
  );
}

const focusOnMount = (element: HTMLElement | null) => element?.focus();

type AuthTitleProps = {
  /** Takes focus as it appears, for a card that replaces the form the user was in. */
  focus?: boolean;
  children: ReactNode;
};

export function AuthTitle({ focus = false, children }: AuthTitleProps) {
  return (
    <CardTitle
      aria-level={1}
      ref={focus ? focusOnMount : undefined}
      role="heading"
      size="lg"
      tabIndex={focus ? -1 : undefined}
    >
      {children}
    </CardTitle>
  );
}

export function AuthForm({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form noValidate onSubmit={submit}>
      <FieldGroup>{children}</FieldGroup>
    </form>
  );
}

export function AuthSubmit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    // Focusable while pending, so pressing it does not drop keyboard focus.
    <Button disabled={pending} focusableWhenDisabled={pending} type="submit" width="full">
      {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
      {children}
    </Button>
  );
}

type AuthLinkProps = {
  to: '/login' | '/forgot-password';
  /** Opens in a new tab, leaving the page behind as it is. */
  newTab?: boolean;
  children: ReactNode;
};

export function AuthLink({ to, newTab = false, children }: AuthLinkProps) {
  return (
    <Link
      className="text-sm text-muted-foreground hover:text-primary"
      rel={newTab ? 'noopener' : undefined}
      target={newTab ? '_blank' : undefined}
      to={to}
    >
      {children}
    </Link>
  );
}
