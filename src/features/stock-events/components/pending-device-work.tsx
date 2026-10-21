import { Link } from '@tanstack/react-router';
import { Trans, useTranslation } from 'react-i18next';
import { OfflineAlert } from '@/components/offline-alert';
import { useOfflineEvents } from '@/features/stock-events/hooks/use-offline-events';
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import { isPendingDeviceEvent } from '@/features/stock-events/lib/pending-device-event';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { useOnline } from '@/lib/online';

type PendingMessage =
  | 'offline-events.program-pending-online'
  | 'offline-events.program-pending-offline'
  | 'offline-events.stock-pending-online'
  | 'offline-events.stock-pending-offline';

export function PendingDeviceWork({
  match,
  message,
}: {
  match: (event: DeviceEvent) => boolean;
  message: {
    online: PendingMessage;
    offline: PendingMessage;
    values?: { kind: ConfiguredEventKind };
  };
}) {
  const { t } = useTranslation();
  const { events } = useOfflineEvents();
  const online = useOnline();
  const count = events?.filter((event) => match(event) && isPendingDeviceEvent(event)).length ?? 0;
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
