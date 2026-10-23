import { Link } from '@tanstack/react-router';
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

const pendingMessages = {
  offline: 'stock-on-hand.offline-snapshot-pending',
  online: 'stock-on-hand.unreachable-snapshot-pending',
} as const;

type SnapshotAlertProps = { snapshot: DeviceSnapshot } & (
  | { message: SnapshotMessage; pending?: never }
  | { message: 'stock-on-hand.offline-snapshot'; pending: number }
);

export function SnapshotAlert({ snapshot, message, pending }: SnapshotAlertProps) {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const timeZone = useDeploymentTimeZone();
  const time = formatTimestamp(new Date(snapshot.fetchedAt).toISOString(), i18n.language, {
    time: true,
    timeZone,
  });
  const key = pending
    ? pendingMessages[online ? 'online' : 'offline']
    : online
      ? unreachableMessages[message]
      : message;
  return (
    <OfflineAlert>
      <Trans
        t={t}
        i18nKey={key}
        count={pending}
        values={{ time, count: pending }}
        components={{ strong: <strong />, eventLink: <Link to="/offline-events" /> }}
      />
    </OfflineAlert>
  );
}

export type PendingWorkMessage =
  | 'offline-events.program-pending-online'
  | 'offline-events.program-pending-offline'
  | 'offline-events.stock-pending-online'
  | 'offline-events.stock-pending-offline';

export function PendingWorkAlert({
  count,
  message,
}: {
  count: number;
  message: { online: PendingWorkMessage; offline: PendingWorkMessage; values?: { kind: string } };
}) {
  const { t } = useTranslation();
  const online = useOnline();
  if (!count) return null;
  return (
    <OfflineAlert>
      <Trans
        t={t}
        i18nKey={online ? message.online : message.offline}
        count={count}
        values={{ count, ...message.values }}
        components={{ strong: <strong />, eventLink: <Link to="/offline-events" /> }}
      />
    </OfflineAlert>
  );
}
