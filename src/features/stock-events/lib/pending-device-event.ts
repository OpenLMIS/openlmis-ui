import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

export function isPendingDeviceEvent(event: {
  status: DeviceEvent['status'];
  error?: { resolvedAt?: number };
}) {
  return (
    ['queued', 'sending', 'uncertain'].includes(event.status) ||
    (event.status === 'refused' && !event.error?.resolvedAt)
  );
}
