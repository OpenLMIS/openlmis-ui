import { Link } from '@tanstack/react-router';
import { ZapIcon } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOfflineEvents } from '@/features/stock-events/hooks/use-offline-events';
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import { isPendingDeviceEvent } from '@/features/stock-events/lib/pending-device-event';
import { useOnline } from '@/lib/online';

export function PendingDeviceWork({ kind }: { kind: ConfiguredEventKind }) {
  const { t } = useTranslation();
  const { events } = useOfflineEvents();
  const online = useOnline();
  const count =
    events?.filter((event) => event.kind === kind && isPendingDeviceEvent(event)).length ?? 0;
  if (!count) return null;
  return (
    <Alert role="note" variant="offline">
      <ZapIcon aria-hidden="true" />
      <AlertDescription>
        <Trans
          t={t}
          i18nKey={
            online
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
