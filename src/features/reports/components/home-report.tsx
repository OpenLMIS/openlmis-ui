import { useQuery } from '@tanstack/react-query';
import { CatchBoundary } from '@tanstack/react-router';
import { AlertCircleIcon } from 'lucide-react';
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineFailure } from '@/components/app-shell/offline-notice';
import { Alert, AlertAction, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { homeReportOptions } from '@/features/reports/api/queries';
import { DashboardViewer } from '@/features/reports/components/dashboard-viewer';
import { isOnline, useOnline } from '@/lib/online';
import { reportApiError, reportCaughtError } from '@/lib/report-error';
import { getSupersetUrl } from '@/lib/runtime-config';

export function HomeReport({
  userId,
  username,
  revision = 0,
  refreshButton,
}: {
  userId: string;
  username: string;
  revision?: number;
  refreshButton?: RefObject<HTMLButtonElement | null>;
}) {
  const online = useOnline();
  const {
    data: report,
    error,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    ...homeReportOptions(userId),
    enabled: online,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const retry = () => {
    if (isOnline()) void refetch({ cancelRefetch: false });
  };
  const retryAndRestoreFocus = () => {
    if (!isOnline()) return;
    restoreFocus.current = true;
    retry();
  };
  useLayoutEffect(() => {
    if (!restoreFocus.current || isFetching) return;
    restoreFocus.current = false;
    if (
      document.activeElement === document.body ||
      document.activeElement === retryButton.current
    ) {
      (heading.current ?? retryButton.current ?? refreshButton?.current)?.focus();
    }
  });
  const offlineFailure = useOfflineFailure(error, retry);
  useEffect(() => {
    if (error) reportApiError(error);
  }, [error]);

  if (!online || offlineFailure) return null;
  if (isError) {
    return (
      <HomeReportError
        onRetry={retryAndRestoreFocus}
        pending={isFetching}
        buttonRef={retryButton}
      />
    );
  }
  if (!report) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 ref={heading} tabIndex={-1} className="wrap-anywhere">
            {report.name}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-128 min-w-0 flex-col">
          <CatchBoundary
            key={`${report.id}:${revision}`}
            getResetKey={() => revision}
            onCatch={reportCaughtError}
            errorComponent={({ reset }) => (
              <HomeReportError
                onRetry={() => {
                  heading.current?.focus();
                  reset();
                }}
              />
            )}
          >
            <DashboardViewer
              onReload={retryAndRestoreFocus}
              placement="home"
              report={report}
              supersetUrl={getSupersetUrl(report.embeddedUuid ? 'embedded' : 'legacy')}
              userId={userId}
              username={username}
            />
          </CatchBoundary>
        </div>
      </CardContent>
    </Card>
  );
}

function HomeReportError({
  onRetry,
  pending,
  buttonRef,
}: {
  onRetry: () => void;
  pending?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation();
  return (
    <Alert variant="destructive" actionLayout="inline">
      <AlertCircleIcon />
      <AlertTitle>{t('home.load-error')}</AlertTitle>
      <AlertAction>
        <Button
          ref={buttonRef}
          disabled={pending}
          onClick={onRetry}
          size="sm"
          type="button"
          variant="outline"
        >
          {t('error.try-again')}
        </Button>
      </AlertAction>
    </Alert>
  );
}
