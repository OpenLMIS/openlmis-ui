import { Link } from '@tanstack/react-router';
import { ZapIcon } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOfflineEvents } from '@/features/stock-events/hooks/use-offline-events';
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import { isPendingDeviceEvent } from '@/features/stock-events/lib/pending-device-event';
import { useOnline } from '@/lib/online';

export function PendingDeviceWork(
  props: { kind: ConfiguredEventKind } | { facilityId: string; programId: string },
) {
  const kind = 'kind' in props ? props.kind : undefined;
  const { t } = useTranslation();
  const { events } = useOfflineEvents();
  const online = useOnline();
  const count =
    events?.filter((event) =>
      'kind' in props
        ? event.kind === props.kind && isPendingDeviceEvent(event)
        : event.facilityId === props.facilityId &&
          event.programId === props.programId &&
          isPendingDeviceEvent(event),
    ).length ?? 0;
  if (!count) return null;
  return (
    <Alert role="note" variant="offline">
      <ZapIcon aria-hidden="true" />
      <AlertDescription>
        <Trans
          t={t}
          i18nKey={
            !kind
              ? 'offline-events.stock-pending'
              : online
                ? 'offline-events.program-pending-online'
                : 'offline-events.program-pending-offline'
          }
          count={count}
          values={{ count, kind }}
          components={{ strong: <strong />, eventLink: <Link to="/offline-events" /> }}
        />
      </AlertDescription>
    </Alert>
  );
}
