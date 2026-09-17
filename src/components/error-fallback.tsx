import type { ErrorComponentProps } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { AlertTriangleIcon, ChevronLeft, RotateCcwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export function ErrorFallback({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const parsedError = error instanceof Error ? error : new Error(String(error));

  return (
    <Empty height="screen">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertTriangleIcon />
        </EmptyMedia>
        <EmptyTitle>{t('error.title')}</EmptyTitle>
        <EmptyDescription>{t('error.description')}</EmptyDescription>
      </EmptyHeader>
      {import.meta.env.DEV && (
        <div className="w-full max-w-xl overflow-hidden border bg-muted text-left">
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
              <ChevronLeft />
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
