import { ZapIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import type { DeviceSnapshot } from '@/lib/local-data';

export function OfflineAlert({
  snapshot,
  children,
}: {
  snapshot?: DeviceSnapshot;
  children: ReactNode;
}) {
  return (
    <Alert role="note" variant="offline">
      <ZapIcon aria-hidden="true" />
      <AlertDescription>
        {snapshot ? (
          <div className="flex flex-col gap-1">
            <div>{children}</div>
            <DownloadedAt snapshot={snapshot} />
          </div>
        ) : (
          children
        )}
      </AlertDescription>
    </Alert>
  );
}

function DownloadedAt({ snapshot }: { snapshot: DeviceSnapshot }) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  return (
    <div>
      {t('offline.downloaded-at', {
        time: formatTimestamp(new Date(snapshot.fetchedAt).toISOString(), i18n.language, {
          time: true,
          timeZone,
        }),
      })}
    </div>
  );
}
