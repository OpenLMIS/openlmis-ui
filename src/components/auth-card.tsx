import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Logo } from '@/components/logo';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Card, CardFooter, CardHeader } from '@/components/ui/card';

/** A signed-out page: one card in the middle, with the language and theme switchers. */
export function AuthPage({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <section className="relative flex min-h-svh w-full flex-col items-center justify-center bg-muted px-6 py-12 text-foreground dark:bg-background">
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
