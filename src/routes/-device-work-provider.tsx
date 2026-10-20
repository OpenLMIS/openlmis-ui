import { onlineManager } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { type ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import { DeviceWorkContext } from '@/components/device-work';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import {
  fetchFacility,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import { useDeviceEvents } from '@/features/stock-events/hooks/use-device-events';
import { retryDownloadRead } from '@/features/stock-events/lib/download-read';
import { isPendingDeviceEvent } from '@/features/stock-events/lib/pending-device-event';
import {
  isForegroundStockEvent,
  useForegroundStockEventIds,
} from '@/features/stock-events/lib/stock-event-delivery';
import { countUnsyncedDeviceWork } from '@/features/stock-events/lib/unsynced-device-work';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import i18n from '@/integrations/i18n';
import { isChunkLoadError, reloadOnce } from '@/lib/chunk-load';
import { isOnline } from '@/lib/online';

export function DeviceWorkProvider({
  children,
  initialTrigger,
}: {
  children: ReactNode;
  initialTrigger: 'boot' | 'force';
}) {
  const { events, hasDeviceEvents } = useDeviceEvents(true, true);
  const foreground = useForegroundStockEventIds(
    events?.some((event) => event.status === 'queued' || event.status === 'sending') ?? false,
  );
  useEffect(() => startDeviceWorkServices(initialTrigger), [initialTrigger]);
  return (
    <DeviceWorkContext
      value={{
        hasDeviceEvents,
        pending: events?.filter(isPendingDeviceEvent).length ?? 0,
        waiting:
          events?.filter(
            (event) =>
              !isForegroundStockEvent(event) &&
              !foreground.has(event.localEventId) &&
              !event.pauseReason &&
              ['queued', 'sending'].includes(event.status),
          ).length ?? 0,
        uncertain: events?.filter((event) => event.status === 'uncertain').length ?? 0,
        refused:
          events?.filter((event) => event.status === 'refused' && !event.error?.resolvedAt)
            .length ?? 0,
        sending:
          events?.some(
            (event) =>
              !isForegroundStockEvent(event) &&
              !foreground.has(event.localEventId) &&
              event.status === 'sending',
          ) ?? false,
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

export function deviceAccessReaders(
  config: AxiosRequestConfig,
  check: () => void,
  purpose: 'download' | 'upload' = 'download',
) {
  const read = <T,>(task: () => Promise<T>) =>
    purpose === 'download' ? retryDownloadRead(task, check) : task();
  return {
    permissions: (id: string) => read(() => fetchPermissionStrings(id, config)),
    user: (id: string) => read(() => fetchUserRecord(id, config)),
    programs: (id: string) => read(() => fetchUserPrograms(id, config)),
    home: (id: string) => read(() => fetchFacility(id, config)),
  };
}

const loadDeviceWorkServices = () =>
  Promise.all([
    import('@/lib/offline-coordinator'),
    import('@/features/stock-events/lib/stock-event-uploader'),
    import('@/features/stock-events/lib/home-stock-provider'),
  ]);

export function startDeviceWorkServices(
  initialTrigger: 'boot' | 'force',
  load: typeof loadDeviceWorkServices = loadDeviceWorkServices,
) {
  let active = true;
  let loading = false;
  let failure: unknown;
  let stop: (() => void) | undefined;
  const recover = () => {
    if (isChunkLoadError(failure) && isOnline()) {
      whenLeaveAllowed(() => {
        if (!active || !isChunkLoadError(failure)) return;
        reloadOnce(() => {
          allowUnload();
          window.location.reload();
        });
      });
    }
  };
  const start = async () => {
    if (!active || loading || stop) return;
    loading = true;
    try {
      const [coordinator, uploader, { homeStockProvider }] = await load();
      if (!active) return;
      const stopCoordinator = coordinator.startOfflineCoordinator({
        initialTrigger,
        providers: [homeStockProvider()],
        access: deviceAccessReaders,
        onTimeZoneFallback: () =>
          toast.info(i18n.t('offline.download.time-zone-fallback-title'), {
            description: i18n.t('offline.download.time-zone-fallback-description'),
          }),
      });
      try {
        const stopUploader = uploader.startStockEventUploader();
        stop = () => {
          stopUploader();
          stopCoordinator();
        };
      } catch (error) {
        stopCoordinator();
        throw error;
      }
      failure = undefined;
    } catch (error) {
      failure = error;
      if (active) recover();
    } finally {
      loading = false;
    }
  };
  const unsubscribe = onlineManager.subscribe((online) => {
    if (online) void start();
  });
  const visible = () => {
    if (document.visibilityState === 'visible') void start();
  };
  document.addEventListener('visibilitychange', visible);
  void start();
  return () => {
    active = false;
    unsubscribe();
    document.removeEventListener('visibilitychange', visible);
    stop?.();
  };
}
