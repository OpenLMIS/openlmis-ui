import {
  AlertTriangleIcon,
  CircleXIcon,
  ClockIcon,
  CopyIcon,
  HourglassIcon,
  LoaderCircleIcon,
  PauseIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { errorState, pendingState } from '@/features/stock-events/lib/offline-event-tabs';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

const pendingStates = {
  held: { key: 'offline-events.state-held', Icon: PauseIcon },
  waiting: { key: 'offline-events.state-waiting', Icon: HourglassIcon },
  queued: { key: 'offline-events.status-queued', Icon: ClockIcon },
  sending: { key: 'offline-events.status-sending', Icon: LoaderCircleIcon },
} as const;
const errorStates = {
  copied: { key: 'offline-events.copied', Icon: CopyIcon },
  uncertain: { key: 'offline-events.status-uncertain', Icon: AlertTriangleIcon },
  'stock-changed': { key: 'offline-events.stock-changed', Icon: CircleXIcon },
  refused: { key: 'offline-events.status-refused', Icon: CircleXIcon },
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
  const { key, Icon } = pendingStates[state];
  return (
    <Badge variant={state === 'held' || state === 'waiting' ? 'warning' : 'info'}>
      <Icon
        aria-hidden="true"
        data-icon="inline-start"
        className={state === 'sending' ? 'animate-spin motion-reduce:animate-none' : undefined}
      />
      {t(key)}
    </Badge>
  );
}

export function OfflineEventErrorMessage({ event }: { event: DeviceEvent }) {
  const { t } = useTranslation();
  const state = errorState(event);
  const { key, Icon } = errorStates[state];
  return (
    <Badge variant={state === 'uncertain' || state === 'copied' ? 'warning' : 'destructive'}>
      <Icon aria-hidden="true" data-icon="inline-start" />
      {t(key)}
    </Badge>
  );
}
