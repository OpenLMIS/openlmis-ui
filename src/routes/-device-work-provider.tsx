import { onlineManager } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { AxiosRequestConfig } from 'axios';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { type DeviceWork, DeviceWorkPublisher, EMPTY_DEVICE_WORK } from '@/components/device-work';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import {
  fetchFacility,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import { useOfflineEvents } from '@/features/stock-events/hooks/use-offline-events';
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
import { getSessionScope, useSessionScope } from '@/lib/session-scope';
import { DeviceStatusProvider } from '@/routes/-device-status-provider';

export function DeviceWorkProvider({ initialTrigger }: { initialTrigger: 'boot' | 'force' }) {
  const scope = useSessionScope();
  const navigate = useNavigate();
  const reviewRefused = useCallback(() => {
    void navigate({ to: '/offline-events', search: { tab: 'errors' } });
  }, [navigate]);
  const { events, hasDeviceEvents } = useOfflineEvents(true, true);
  const foreground = useForegroundStockEventIds(
    events?.some((event) => event.status === 'queued' || event.status === 'sending') ?? false,
  );
  const services = useRef<{ refresh: (key: string) => void } | undefined>(undefined);
  const refreshOfflineDownload = useCallback((key: string) => services.current?.refresh(key), []);
  useEffect(() => {
    const stop = startDeviceWorkServices(
      initialTrigger,
      loadDeviceWorkServices,
      (current) => {
        services.current = current;
      },
      reviewRefused,
    );
    return () => {
      services.current = undefined;
      stop();
    };
  }, [initialTrigger, reviewRefused]);
  const publish = useContext(DeviceWorkPublisher);
  const pending = events?.filter(isPendingDeviceEvent).length ?? 0;
  const waiting =
    events?.filter(
      (event) =>
        !isForegroundStockEvent(event) &&
        !foreground.has(event.localEventId) &&
        !event.pauseReason &&
        ['queued', 'sending'].includes(event.status),
    ).length ?? 0;
  const uncertain = events?.filter((event) => event.status === 'uncertain').length ?? 0;
  const refused =
    events?.filter((event) => event.status === 'refused' && !event.error?.resolvedAt).length ?? 0;
  const sending =
    events?.some(
      (event) =>
        !isForegroundStockEvent(event) &&
        !foreground.has(event.localEventId) &&
        event.status === 'sending',
    ) ?? false;
  const retained = events?.some((event) => event.status !== 'accepted') ?? false;
  const accessChanged = events?.some((event) => event.pauseReason === 'access-changed') ?? false;
  const draftChanged = events?.some((event) => event.pauseReason === 'draft-changed') ?? false;
  const value = useMemo<DeviceWork>(
    () => ({
      hasDeviceEvents,
      pending,
      waiting,
      uncertain,
      refused,
      sending,
      retained,
      pauses: [
        ...(accessChanged ? ['access-changed' as const] : []),
        ...(draftChanged ? ['draft-changed' as const] : []),
      ],
      countUnsyncedWork: countUnsyncedDeviceWork,
      refreshOfflineDownload,
    }),
    [
      hasDeviceEvents,
      pending,
      waiting,
      uncertain,
      refused,
      sending,
      retained,
      accessChanged,
      draftChanged,
      refreshOfflineDownload,
    ],
  );
  useEffect(() => {
    if (scope === getSessionScope()) publish(value);
  }, [publish, value, scope]);
  useEffect(() => () => publish(EMPTY_DEVICE_WORK), [publish]);
  return <DeviceStatusProvider />;
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
  onReady?: (
    services: ReturnType<typeof import('@/lib/offline-coordinator').startOfflineCoordinator>,
  ) => void,
  reviewRefused?: () => void,
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
      const services = coordinator.startOfflineCoordinator({
        initialTrigger,
        providers: [homeStockProvider()],
        access: deviceAccessReaders,
        onTimeZoneFallback: () =>
          toast.info(i18n.t('offline.download.time-zone-fallback-title'), {
            description: i18n.t('offline.download.time-zone-fallback-description'),
          }),
      });
      try {
        const stopUploader = uploader.startStockEventUploader({
          access: services.freshAccess,
          refresh: services.refresh,
          reviewRefused,
        });
        onReady?.(services);
        stop = () => {
          stopUploader();
          services.stop();
        };
      } catch (error) {
        services.stop();
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
