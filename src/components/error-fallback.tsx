import type { ErrorComponentProps } from '@tanstack/react-router';
import { Link, useRouter } from '@tanstack/react-router';
import { HouseIcon, RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoAccessPage } from '@/components/no-access-page';
import { OfflineNotice, useOfflineFailure } from '@/components/offline-notice';
import { StatusPage } from '@/components/status-page';
import { Button } from '@/components/ui/button';
import {
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { isForbidden } from '@/features/auth/lib/access';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { isChunkLoadError, reloadOnce } from '@/lib/chunk-load';
import { isOfflineError } from '@/lib/http';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { OfflinePageUnavailableError } from '@/lib/offline-capability';
import { isOnline, seedOnline } from '@/lib/online';

const reloadPage = () => {
  allowUnload();
  window.location.reload();
};

type ErrorFallbackProps = ErrorComponentProps & {
  title?: string;
  description?: string;
  back?: ReactNode;
};

export function ErrorFallback({ error, reset, title, description, back }: ErrorFallbackProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const staleApp = isChunkLoadError(error);
  const [failedOffline] = useState(() => !isOnline());
  const rerun = () => {
    void router.invalidate();
    reset();
  };
  const retry = () => {
    seedOnline();
    if (!isOnline()) return;
    if (staleApp) whenLeaveAllowed(() => reloadOnce(reloadPage) || rerun());
    else rerun();
  };
  const offline = useOfflineFailure(error, retry, failedOffline && !isForbidden(error));
  useEffect(() => {
    if (staleApp && isOnline()) whenLeaveAllowed(() => reloadOnce(reloadPage));
  }, [staleApp]);
  // A route that needs a right it lacks, or a refusal from the server, is not an error.
  if (isForbidden(error)) return <NoAccessPage />;
  if (offline)
    return (
      <OfflineNotice
        headingLevel={1}
        onRetry={retry}
        reason={
          error instanceof OfflinePageUnavailableError
            ? 'online-only'
            : error instanceof LocalDataUnavailableError || staleApp || !isOfflineError(error)
              ? 'not-downloaded'
              : undefined
        }
      />
    );
  const parsedError = error instanceof Error ? error : new Error(String(error));

  return (
    <StatusPage>
      <EmptyHeader>
        <EmptyMedia size="lg" variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-label">
          {t('error.eyebrow')}
        </p>
        <EmptyTitle size="lg">
          <h1>{title ?? t('error.title')}</h1>
        </EmptyTitle>
        <EmptyDescription size="lg">{description ?? t('error.description')}</EmptyDescription>
      </EmptyHeader>
      {import.meta.env.DEV && (
        <div
          className="w-full max-w-xl overflow-hidden rounded-md border bg-muted text-start"
          dir="ltr"
        >
          <p className="break-words border-b px-3 py-2 font-mono font-semibold text-muted-foreground text-xs">
            {parsedError.name}: {parsedError.message}
          </p>
          {parsedError.stack && (
            <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-2xs text-muted-foreground leading-relaxed">
              {parsedError.stack}
            </pre>
          )}
        </div>
      )}
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={retry} size="lg" variant="outline">
            <RotateCcwIcon data-icon="inline-start" />
            {t('error.try-again')}
          </Button>
          {back ?? (
            <Button nativeButton={false} render={<Link to="/home" />} size="lg">
              <HouseIcon data-icon="inline-start" />
              {t('not-found.back-home')}
            </Button>
          )}
        </div>
      </EmptyContent>
    </StatusPage>
  );
}
