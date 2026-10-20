import type { ParseKeys } from 'i18next';
import { createContext, useContext } from 'react';
import type { NoticeCountdown } from '@/lib/notice-countdown';

export type DeviceWork = {
  hasDeviceEvents: boolean;
  waiting: number;
  pending: number;
  uncertain: number;
  refused: number;
  sending: boolean;
  retained: boolean;
  pauses: readonly ('access-changed' | 'draft-changed')[];
  countUnsyncedWork: () => Promise<number>;
  refreshOfflineDownload: (refreshKey: string) => void;
};
export const EMPTY_DEVICE_WORK: DeviceWork = {
  hasDeviceEvents: false,
  waiting: 0,
  pending: 0,
  uncertain: 0,
  refused: 0,
  sending: false,
  retained: false,
  pauses: [],
  refreshOfflineDownload: () => {},
  countUnsyncedWork: async () => {
    throw new Error('Device work is not available.');
  },
};
export const DeviceWorkContext = createContext<DeviceWork>(EMPTY_DEVICE_WORK);
export const DeviceWorkPublisher = createContext<(work: DeviceWork) => void>(() => {});
export const useDeviceWork = () => useContext(DeviceWorkContext);

export type DeviceSync = {
  phase: 'idle' | 'syncing' | 'complete' | 'session' | 'unsupported' | 'receipt' | 'failed';
  countdown?: NoticeCountdown;
  queued: { count: number } | null;
  save: ParseKeys | null;
  wake: () => void;
};
export const EMPTY_DEVICE_SYNC: DeviceSync = {
  phase: 'idle',
  queued: null,
  save: null,
  wake: () => {},
};
export const DeviceSyncContext = createContext<DeviceSync>(EMPTY_DEVICE_SYNC);
export const DeviceSyncPublisher = createContext<(sync: DeviceSync) => void>(() => {});
export const useDeviceSync = () => useContext(DeviceSyncContext);
