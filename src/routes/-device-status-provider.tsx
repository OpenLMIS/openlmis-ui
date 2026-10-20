import type { ReactNode } from 'react';
import { DeviceSyncContext } from '@/components/device-work';
import {
  syncCountdown,
  useQueuedAnnouncement,
  useSyncPhase,
  wakeStockEventSync,
} from '@/features/stock-events/lib/device-event-status';
import { useDeviceSaveAnnouncement } from '@/features/stock-events/lib/device-save-announcement';

export function DeviceStatusProvider({ children }: { children: ReactNode }) {
  const phase = useSyncPhase();
  const queued = useQueuedAnnouncement();
  const save = useDeviceSaveAnnouncement();
  return (
    <DeviceSyncContext
      value={{ phase, queued, save, countdown: syncCountdown, wake: wakeStockEventSync }}
    >
      {children}
    </DeviceSyncContext>
  );
}
