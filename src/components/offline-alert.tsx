import { ZapIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import type { DeviceSnapshot } from '@/lib/local-data';

export function OfflineAlert({ children }: { children: ReactNode }) {
  return (
    <Alert role="note" variant="offline">
      <ZapIcon aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

type SnapshotMessage =
  | 'stock-on-hand.offline-snapshot'
  | 'stock-card.offline-history'
  | 'stock-card.offline-summary';

export function SnapshotAlert({
  snapshot,
  message,
}: {
  snapshot: DeviceSnapshot;
  message: SnapshotMessage;
}) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const time = formatTimestamp(new Date(snapshot.fetchedAt).toISOString(), i18n.language, {
    time: true,
    timeZone,
  });
  return (
    <OfflineAlert>
      <Trans t={t} i18nKey={message} values={{ time }} components={{ strong: <strong /> }} />
    </OfflineAlert>
  );
}
