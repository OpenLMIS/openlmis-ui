import { type ReactNode, useEffect } from 'react';
import { DeviceWorkContext } from '@/components/device-work';
import { useDeviceEvents } from '@/features/stock-events/hooks/use-device-events';
import { countUnsyncedDeviceWork } from '@/features/stock-events/lib/unsynced-device-work';

export function DeviceWorkProvider({ children }: { children: ReactNode }) {
  const { events, hasDeviceEvents } = useDeviceEvents(true, true);
  useEffect(() => {
    let active = true;
    let stop: (() => void) | undefined;
    void Promise.all([
      import('@/lib/offline-coordinator'),
      import('@/features/stock-events/lib/stock-event-uploader'),
    ]).then(([coordinator, uploader]) => {
      if (!active) return;
      const stopCoordinator = coordinator.startOfflineCoordinator();
      const stopUploader = uploader.startStockEventUploader();
      stop = () => {
        stopUploader();
        stopCoordinator();
      };
    });
    return () => {
      active = false;
      stop?.();
    };
  }, []);
  return (
    <DeviceWorkContext
      value={{
        hasDeviceEvents,
        waiting:
          events?.filter(
            (event) => !event.pauseReason && ['queued', 'sending'].includes(event.status),
          ).length ?? 0,
        uncertain: events?.filter((event) => event.status === 'uncertain').length ?? 0,
        refused:
          events?.filter((event) => event.status === 'refused' && !event.error?.resolvedAt)
            .length ?? 0,
        sending: events?.some((event) => event.status === 'sending') ?? false,
        retained: events?.some((event) => event.status !== 'accepted') ?? false,
        pauses: (['access-changed', 'draft-changed'] as const).filter((reason) =>
          events?.some((event) => event.pauseReason === reason),
        ),
        countUnsyncedWork: countUnsyncedDeviceWork,
      }}
    >
      {children}
    </DeviceWorkContext>
  );
}
