import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';

export function DownloadedAt({ timestamp }: { timestamp: number }) {
  const { t, i18n } = useTranslation();
  const { data } = useQuery(deploymentTimeZoneOptions());
  return (
    <p className="text-muted-foreground text-sm">
      {t('offline.downloaded-at', {
        time: formatTimestamp(new Date(timestamp).toISOString(), i18n.language, {
          time: true,
          timeZone: data?.zone ?? 'UTC',
        }),
      })}
    </p>
  );
}
