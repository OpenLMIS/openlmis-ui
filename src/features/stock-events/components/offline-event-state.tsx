import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { errorState, pendingState } from '@/features/stock-events/lib/offline-event-tabs';
import { refusalMessage } from '@/features/stock-events/lib/refusal-message';
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
    <div className="flex flex-col items-start gap-1 whitespace-normal">
      <Badge variant={state === 'held' || state === 'waiting' ? 'warning' : 'info'}>
        {t(pendingKeys[state])}
      </Badge>
      {state === 'held' && (
        <p>
          {t(
            event.pauseReason === 'access-changed'
              ? 'offline-events.access-changed-held-description'
              : 'offline-events.draft-changed-held-description',
          )}
        </p>
      )}
      {state === 'waiting' && <p>{t('offline-events.waiting-description')}</p>}
    </div>
  );
}

export function OfflineEventErrorMessage({ event }: { event: DeviceEvent }) {
  const { t } = useTranslation();
  const state = errorState(event);
  return (
    <div className="flex flex-col items-start gap-2 whitespace-normal wrap-anywhere">
      <Badge variant={state === 'uncertain' || state === 'copied' ? 'warning' : 'destructive'}>
        {t(errorKeys[state])}
      </Badge>
      <p>
        {state === 'uncertain'
          ? t('offline-events.error-uncertain')
          : t('offline-events.could-not-perform', {
              message: refusalMessage(
                event.error,
                t,
                state === 'copied'
                  ? 'offline-events.no-refusal-details'
                  : 'offline-events.no-error-details',
              ),
            })}
      </p>
    </div>
  );
}
