import { ZapIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import type { DeviceSnapshot } from '@/lib/local-data';
import { useOnline } from '@/lib/online';

export function OfflineAlert({ children }: { children: ReactNode }) {
  return (
    <Alert role="note" variant="offline">
      <ZapIcon aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

type SnapshotMessage =
  | 'stock-events.offline-snapshot'
  | 'stock-on-hand.offline-snapshot'
  | 'stock-card.offline-history'
  | 'stock-card.offline-summary';

const unreachableMessages = {
  'stock-events.offline-snapshot': 'offline.stock-snapshot-unreachable',
  'stock-on-hand.offline-snapshot': 'offline.stock-snapshot-unreachable',
  'stock-card.offline-history': 'stock-card.unreachable-history',
  'stock-card.offline-summary': 'stock-card.unreachable-summary',
} as const satisfies Record<SnapshotMessage, string>;

export function SnapshotAlert({
  snapshot,
  message,
}: {
  snapshot: DeviceSnapshot;
  message: SnapshotMessage;
}) {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const timeZone = useDeploymentTimeZone();
  const time = formatTimestamp(new Date(snapshot.fetchedAt).toISOString(), i18n.language, {
    time: true,
    timeZone,
  });
  return (
    <OfflineAlert>
      <Trans
        t={t}
        i18nKey={online ? unreachableMessages[message] : message}
        values={{ time }}
        components={{ strong: <strong /> }}
      />
    </OfflineAlert>
  );
}
