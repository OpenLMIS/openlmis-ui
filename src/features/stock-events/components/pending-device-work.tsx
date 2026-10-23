import { PendingWorkAlert, type PendingWorkMessage } from '@/components/offline-alert';
import { useOfflineEvents } from '@/features/stock-events/hooks/use-offline-events';
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import { isPendingDeviceEvent } from '@/features/stock-events/lib/pending-device-event';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

export function usePendingDeviceCount(match: (event: DeviceEvent) => boolean) {
  const { events } = useOfflineEvents(true, true);
  return events?.filter((event) => match(event) && isPendingDeviceEvent(event)).length ?? 0;
}

export function PendingDeviceWork({
  match,
  message,
}: {
  match: (event: DeviceEvent) => boolean;
  message: {
    online: PendingWorkMessage;
    offline: PendingWorkMessage;
    values?: { kind: ConfiguredEventKind };
  };
}) {
  return <PendingWorkAlert count={usePendingDeviceCount(match)} message={message} />;
}
