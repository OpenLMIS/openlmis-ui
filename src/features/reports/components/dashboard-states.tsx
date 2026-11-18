import { Link } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ExternalLinkIcon, RotateCcwIcon, ServerOffIcon, TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { OfflineNotice, useOfflineFailure } from '@/components/app-shell/offline-notice';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty,
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

export type DashboardFailure = { kind: DashboardFailureKind; error?: unknown };

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
} as const;

export function BackToReports() {
  const { t } = useTranslation();
  return (
    <Button nativeButton={false} render={<Link to="/reports" />} variant="outline">
      {t('reports.dashboard.back')}
    </Button>
  );
}

/** Moves focus to a failure's title only when a Try Again has just failed again. */
function useFailureFocus<T extends HTMLElement>(focus: boolean) {
  const title = useRef<T>(null);
  useEffect(() => {
    if (focus) title.current?.focus();
  }, [focus]);
  return title;
}

export function DashboardFailureState({
  failure,
  onRetry,
  focus,
}: {
  failure: DashboardFailure;
  onRetry: () => void;
  focus: boolean;
}) {
  const { t } = useTranslation();
  const title = useFailureFocus<HTMLDivElement>(focus);
  const offline = useOfflineFailure(failure.error, onRetry, failure.kind === 'offline');
  if (offline || failure.kind === 'offline') return <OfflineNotice onRetry={onRetry} />;
  if (failure.kind === 'not-set-up') return <DashboardNotSetUp titleRef={title} />;
  const [titleKey, descriptionKey] = FAILURE_TEXT[failure.kind];
  const back = failure.kind === 'refused' || failure.kind === 'not-registered';
  return (
    <Alert variant="destructive" actionLayout="flow">
      <TriangleAlertIcon />
      <AlertTitle ref={title} tabIndex={-1}>
        {t(titleKey)}
      </AlertTitle>
      <AlertDescription>{t(descriptionKey)}</AlertDescription>
      <AlertAction>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRetry}>
            <RotateCcwIcon data-icon="inline-start" />
            {t('error.try-again')}
          </Button>
          {back && <BackToReports />}
        </div>
      </AlertAction>
    </Alert>
  );
}

export function DashboardNotSetUp({ titleRef }: { titleRef?: React.Ref<HTMLDivElement> }) {
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <div
        aria-busy={connecting}
        className="relative h-svh min-h-120 overflow-hidden rounded-lg border"
      >
        <div className={connecting ? 'invisible size-full' : 'size-full'}>{frame}</div>
        {connecting && (
          <div className="absolute inset-0 flex flex-col gap-3 p-4">
            <p className="text-sm text-muted-foreground">{t('reports.dashboard.connecting')}</p>
            <div aria-hidden="true" className="flex-1">
              <Skeleton fill />
            </div>
          </div>
        )}
      </div>
      {recovery}
    </div>
  );
}

export function DashboardRecovery({ onRetry, link }: { onRetry: () => void; link?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>{t('reports.dashboard.not-showing')}</span>
      <Button variant="link" padding="none" onClick={onRetry}>
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
  return (
    <div aria-hidden="true" className="h-svh min-h-120">
      <Skeleton fill />
    </div>
  );
}
