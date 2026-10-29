import { useContext, useEffect, useMemo } from 'react';
import { DeviceSyncPublisher, EMPTY_DEVICE_SYNC } from '@/components/app-shell/device-work';
import {
  syncCountdown,
  useQueuedAnnouncement,
  useSyncPhase,
  wakeStockEventSync,
} from '@/features/stock-events/lib/device-event-status';
import { useDeviceSaveAnnouncement } from '@/features/stock-events/lib/device-save-announcement';

export function DeviceStatusProvider() {
  const phase = useSyncPhase();
  const queued = useQueuedAnnouncement();
  const save = useDeviceSaveAnnouncement();
  const publish = useContext(DeviceSyncPublisher);
  const value = useMemo(
    () => ({ phase, queued, save, countdown: syncCountdown, wake: wakeStockEventSync }),
    [phase, queued, save],
  );
  useEffect(() => publish(value), [publish, value]);
  useEffect(() => () => publish(EMPTY_DEVICE_SYNC), [publish]);
  return null;
}
