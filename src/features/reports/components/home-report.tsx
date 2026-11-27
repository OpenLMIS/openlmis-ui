import { useQuery } from '@tanstack/react-query';
import { AlertCircleIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineFailure } from '@/components/app-shell/offline-notice';
import { Alert, AlertAction, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { homeReportOptions } from '@/features/reports/api/queries';
import { DashboardViewer } from '@/features/reports/components/dashboard-viewer';
import { isOnline, useOnline } from '@/lib/online';
import { reportApiError } from '@/lib/report-error';
import { getSupersetUrl } from '@/lib/runtime-config';

export function HomeReport({ userId, username }: { userId: string; username: string }) {
  const { t } = useTranslation();
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
  const retry = () => {
    if (isOnline()) void refetch({ cancelRefetch: false });
  };
  const offlineFailure = useOfflineFailure(error, retry);
  useEffect(() => {
    if (error) reportApiError(error);
  }, [error]);

  if (!online || offlineFailure) return null;
  if (isError) {
    return (
      <Alert variant="destructive" actionLayout="inline">
        <AlertCircleIcon />
        <AlertTitle>{t('home.load-error')}</AlertTitle>
        <AlertAction>
          <Button disabled={isFetching} onClick={retry} size="sm" type="button" variant="outline">
            {t('error.try-again')}
          </Button>
        </AlertAction>
      </Alert>
    );
  }
  if (!report) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="wrap-anywhere">{report.name}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-128 min-w-0 flex-col">
          <DashboardViewer
            key={report.id}
            onReload={retry}
            placement="home"
            report={report}
            supersetUrl={getSupersetUrl(report.embeddedUuid ? 'embedded' : 'legacy')}
            userId={userId}
            username={username}
          />
        </div>
      </CardContent>
    </Card>
  );
}
