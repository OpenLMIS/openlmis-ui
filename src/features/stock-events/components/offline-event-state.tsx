import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { errorState, pendingState } from '@/features/stock-events/lib/offline-event-tabs';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

const pendingKeys = {
  held: 'offline-events.state-held',
  waiting: 'offline-events.state-waiting',
  queued: 'offline-events.status-queued',
  sending: 'offline-events.status-sending',
} as const;
const errorKeys = {
  copied: 'offline-events.copied',
  uncertain: 'offline-events.status-uncertain',
  'stock-changed': 'offline-events.stock-changed',
  refused: 'offline-events.status-refused',
} as const;

export function OfflineEventPendingState({
  event,
  blocked,
}: {
  event: DeviceEvent;
  blocked: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const state = pendingState(event, blocked);
  return (
    <Badge variant={state === 'held' || state === 'waiting' ? 'warning' : 'info'}>
      {t(pendingKeys[state])}
    </Badge>
  );
}

export function OfflineEventErrorMessage({ event }: { event: DeviceEvent }) {
  const { t } = useTranslation();
  const state = errorState(event);
  return (
    <Badge variant={state === 'uncertain' || state === 'copied' ? 'warning' : 'destructive'}>
      {t(errorKeys[state])}
    </Badge>
  );
}
