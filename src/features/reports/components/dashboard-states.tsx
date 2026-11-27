import { Link } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ExternalLinkIcon, RotateCcwIcon, ServerOffIcon, TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { OfflineNotice, useOfflineFailure } from '@/components/app-shell/offline-notice';
import { RetryButton } from '@/components/display/dialog-parts';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { isOfflineError } from '@/lib/http';

export type DashboardFailureKind =
  | 'offline'
  | 'refused'
  | 'not-registered'
  | 'not-set-up'
  | 'unavailable'
  | 'did-not-load';

export type DashboardFailure =
  | { kind: DashboardFailureKind; error?: unknown }
  | { kind: 'account-mismatch'; logoutUrl: string; error?: undefined };

/** How long a frame may take to load before the viewer offers Try Again. */
export const FRAME_LOAD_LIMIT_MS = 45_000;

const NOT_CONFIGURED = 'report.error.superset.notConfigured';

/** Maps a guest-token failure to what the viewer tells the user. */
export function tokenFailure(error: unknown): DashboardFailure {
  if (isOfflineError(error)) return { kind: 'offline', error };
  if (!isAxiosError(error) || !error.response) return { kind: 'unavailable', error };
  const { status, data } = error.response;
  if (status === 403) return { kind: 'refused', error };
  if (status === 404) return { kind: 'not-registered', error };
  const messageKey = (data as { messageKey?: unknown } | undefined)?.messageKey;
  if (status === 500 && messageKey === NOT_CONFIGURED) return { kind: 'not-set-up', error };
  return { kind: 'unavailable', error };
}

const FAILURE_TEXT = {
  refused: ['reports.dashboard.refused-title', 'reports.dashboard.refused-description'],
  'not-registered': [
    'reports.dashboard.not-registered-title',
    'reports.dashboard.not-registered-description',
  ],
  unavailable: ['reports.dashboard.unavailable-title', 'reports.dashboard.unavailable-description'],
  'did-not-load': [
    'reports.dashboard.did-not-load-title',
    'reports.dashboard.did-not-load-description',
  ],
  'account-mismatch': [
    'reports.dashboard.account-mismatch-title',
    'reports.dashboard.account-mismatch',
  ],
} as const;

export function BackToReports() {
  const { t } = useTranslation();
  return (
    <Button nativeButton={false} render={<Link to="/reports" />} variant="outline">
      {t('reports.dashboard.back')}
    </Button>
  );
}

/** Restores focus only when retry replaced the focused control. */
export function useRetryFocus<T extends HTMLElement>(focus: boolean) {
  const target = useRef<T>(null);
  useLayoutEffect(() => {
    if (focus && document.activeElement === document.body) target.current?.focus();
  }, [focus]);
  return target;
}

export function DashboardFailureState({
  failure,
  onRetry,
  focus,
  hideBackLink = false,
}: {
  failure: DashboardFailure;
  onRetry: () => void;
  focus: boolean;
  hideBackLink?: boolean;
}) {
  const { t } = useTranslation();
  const title = useRetryFocus<HTMLDivElement>(focus);
  const offlineTitle = useRetryFocus<HTMLHeadingElement>(focus);
  const offline = useOfflineFailure(failure.error, onRetry, failure.kind === 'offline');
  if (offline || failure.kind === 'offline')
    return <OfflineNotice onRetry={onRetry} headingRef={offlineTitle} />;
  if (failure.kind === 'not-set-up')
    return <DashboardNotSetUp titleRef={title} onRetry={hideBackLink ? onRetry : undefined} />;
  const [titleKey, descriptionKey] = FAILURE_TEXT[failure.kind];
  const back = failure.kind === 'refused' || failure.kind === 'not-registered';
  return (
    <Alert variant="destructive" actionLayout="inline">
      <TriangleAlertIcon />
      <AlertTitle ref={title} tabIndex={-1}>
        {t(titleKey)}
      </AlertTitle>
      <AlertDescription>{t(descriptionKey)}</AlertDescription>
      <AlertAction>
        <div className="flex flex-col items-end gap-2">
          <Button variant="destructive" size="sm" onClick={onRetry}>
            <RotateCcwIcon data-icon="inline-start" />
            {t('error.try-again')}
          </Button>
          {failure.kind === 'account-mismatch' && (
            <Button
              role="link"
              nativeButton={false}
              size="sm"
              variant="outline"
              render={<a href={failure.logoutUrl} target="_blank" rel="noopener noreferrer" />}
            >
              {t('reports.dashboard.sign-out')}
            </Button>
          )}
          {back && !hideBackLink && <BackToReports />}
        </div>
      </AlertAction>
    </Alert>
  );
}

export function DashboardNotSetUp({
  titleRef,
  onRetry,
}: {
  titleRef?: React.Ref<HTMLDivElement>;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ServerOffIcon />
        </EmptyMedia>
        <EmptyTitle ref={titleRef} tabIndex={-1}>
          {t('reports.dashboard.not-set-up-title')}
        </EmptyTitle>
        <EmptyDescription>{t('reports.dashboard.not-set-up-description')}</EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <RetryButton onClick={onRetry} />
        </EmptyContent>
      )}
    </Empty>
  );
}

/** The dashboard's area: a placeholder covers the frame until it has connected. */
export function DashboardArea({
  connecting,
  frame,
  recovery,
}: {
  connecting: boolean;
  frame: ReactNode;
  recovery: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <div
        aria-busy={connecting}
        className="relative min-h-80 flex-1 overflow-hidden rounded-lg border"
      >
        <div className={connecting ? 'invisible size-full' : 'size-full'}>{frame}</div>
        {connecting && (
          <div className="absolute inset-0 p-4">
            <DashboardAreaSkeleton />
          </div>
        )}
      </div>
      {recovery}
    </div>
  );
}

export function DashboardRecovery({
  onRetry,
  focus,
  link,
}: {
  onRetry: () => void;
  focus: boolean;
  link?: string;
}) {
  const { t } = useTranslation();
  const retry = useRetryFocus<HTMLButtonElement>(focus);
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>{t('reports.dashboard.not-showing')}</span>
      <Button ref={retry} variant="link" padding="none" onClick={onRetry}>
        <RotateCcwIcon data-icon="inline-start" />
        {t('error.try-again')}
      </Button>
      {link && (
        <Button
          role="link"
          variant="link"
          padding="none"
          nativeButton={false}
          render={<a href={link} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLinkIcon data-icon="inline-start" />
          {t('reports.dashboard.open-new-tab')}
        </Button>
      )}
    </div>
  );
}

export function DashboardAreaSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      aria-busy="true"
      className="@container/dashboard flex h-full flex-col gap-4 overflow-hidden p-px"
    >
      <span className="sr-only">{t('reports.dashboard.connecting')}</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-9 w-36 max-w-full">
              <Skeleton fill />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 @3xl/dashboard:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item} size="sm">
              <CardHeader>
                <div className="h-3 w-20 max-w-full">
                  <Skeleton fill />
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-7 w-16">
                  <Skeleton fill />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 @2xl/dashboard:grid-cols-2">
          <DashboardChartSkeleton />
          <DashboardChartSkeleton />
        </div>
        <Card>
          <CardHeader>
            <div className="h-4 w-40 max-w-full">
              <Skeleton fill />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="grid grid-cols-3 gap-6">
                  <div className="h-3">
                    <Skeleton fill />
                  </div>
                  <div className="h-3">
                    <Skeleton fill />
                  </div>
                  <div className="h-3">
                    <Skeleton fill />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-4 w-36 max-w-full">
          <Skeleton fill />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-3 border-b pb-3">
          {['h-1/3', 'h-3/5', 'h-2/5', 'h-4/5', 'h-1/2', 'h-2/3'].map((height) => (
            <div key={height} className={`flex-1 ${height}`}>
              <Skeleton fill />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
