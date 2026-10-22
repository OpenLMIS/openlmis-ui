import { Link } from '@tanstack/react-router';
import { ZapIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
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
  | 'physical-inventory.offline-snapshot'
  | 'stock-events.offline-snapshot'
  | 'stock-on-hand.offline-snapshot'
  | 'stock-card.offline-history'
  | 'stock-card.offline-summary';

const unreachableMessages = {
  'physical-inventory.offline-snapshot': 'physical-inventory.offline-snapshot',
  'stock-events.offline-snapshot': 'offline.stock-snapshot-unreachable',
  'stock-on-hand.offline-snapshot': 'offline.stock-snapshot-unreachable',
  'stock-card.offline-history': 'stock-card.unreachable-history',
  'stock-card.offline-summary': 'stock-card.unreachable-summary',
} as const satisfies Record<SnapshotMessage, string>;

const pendingMessages = {
  offline: 'stock-on-hand.offline-snapshot-pending',
  online: 'stock-on-hand.unreachable-snapshot-pending',
} as const;

type SnapshotNotice = { online?: boolean; reconnectedAt?: number };

function nextSnapshotNotice(
  notice: SnapshotNotice,
  present: boolean,
  refreshing: boolean,
  updatedAt: number,
  online: boolean,
): SnapshotNotice {
  if (!present) return {};
  if (notice.online === undefined) return { online: refreshing && online ? undefined : online };
  if (!online) return { online: refreshing ? notice.online : false };
  if (notice.online) return { online: true };
  const reconnectedAt = notice.reconnectedAt ?? updatedAt;
  return refreshing || updatedAt === reconnectedAt ? { online: false, reconnectedAt } : { online };
}

export function useSnapshotNotice(present: boolean, refreshing: boolean, updatedAt: number) {
  const online = useOnline();
  const [notice, setNotice] = useState<SnapshotNotice>({});
  const next = nextSnapshotNotice(notice, present, refreshing, updatedAt, online);
  if (next.online !== notice.online || next.reconnectedAt !== notice.reconnectedAt) setNotice(next);
  return next.online;
}

type SnapshotAlertProps = { snapshot: DeviceSnapshot; online: boolean } & (
  | { message: SnapshotMessage; pending?: never }
  | { message: 'stock-on-hand.offline-snapshot'; pending: number }
);

export function SnapshotAlert({ snapshot, message, pending, online }: SnapshotAlertProps) {
  const { t, i18n } = useTranslation();
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
