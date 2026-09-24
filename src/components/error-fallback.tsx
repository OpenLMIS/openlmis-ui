import type { ErrorComponentProps } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { AlertTriangleIcon, ChevronLeft, RotateCcwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NoAccessPage } from '@/components/no-access-page';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { isForbidden } from '@/features/auth/lib/access';

export function ErrorFallback({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  // A route that needs a right it lacks, or a refusal from the server, is not an error.
  if (isForbidden(error)) return <NoAccessPage />;
  const parsedError = error instanceof Error ? error : new Error(String(error));

  return (
    <Empty height="screen">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertTriangleIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h1>{t('error.title')}</h1>
        </EmptyTitle>
        <EmptyDescription>{t('error.description')}</EmptyDescription>
      </EmptyHeader>
      {import.meta.env.DEV && (
        <div className="w-full max-w-xl overflow-hidden border bg-muted text-start">
          <div className="border-b px-3 py-2">
            <p className="break-words font-mono font-semibold text-destructive text-xs">
              {parsedError.name}: {parsedError.message}
            </p>
          </div>
          {parsedError.stack && (
            <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-2xs text-muted-foreground leading-relaxed">
              {parsedError.stack}
            </pre>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        {reset && (
          <Button onClick={reset} size="sm" variant="secondary">
            <RotateCcwIcon />
            {t('error.try-again')}
          </Button>
        )}
        <Button
          render={(props) => (
            <Link {...props} to="/">
              <ChevronLeft className="rtl:rotate-180" />
              {t('not-found.back-home')}
            </Link>
          )}
          nativeButton={false}
          size="sm"
        />
      </div>
    </Empty>
  );
}
