import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import type { DeviceSnapshot } from '@/lib/local-data';

export function DownloadedAt({
  snapshot,
  children,
}: {
  snapshot: DeviceSnapshot;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  return (
    <div className="flex flex-col gap-1 text-muted-foreground text-sm">
      <p>{children}</p>
      <p>
        {t('offline.downloaded-at', {
          time: formatTimestamp(new Date(snapshot.fetchedAt).toISOString(), i18n.language, {
            time: true,
            timeZone,
          }),
        })}
      </p>
    </div>
  );
}
