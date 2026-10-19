import { useSyncExternalStore } from 'react';
import { createNoticeCountdown } from '@/lib/notice-countdown';

export type DownloadStatus = {
  phase: 'idle' | 'running' | 'complete' | 'failed' | 'unsupported';
  incompletePrograms: { id: string; name: string }[];
  reason?: 'timeout' | 'offline' | 'session' | 'read';
  accessFailed?: boolean;
  trigger?: 'boot' | 'force' | 'retry' | 'refresh';
};
const idle: DownloadStatus = { phase: 'idle', incompletePrograms: [] };
let status = idle;
const listeners = new Set<() => void>();
let retry: (() => void) | undefined;
type ProgramScope = { facilityId: string; programId: string };
let refresh: ((scope: ProgramScope) => void) | undefined;
export const downloadCountdown = createNoticeCountdown(() => setDownloadStatus(idle));
export const getDownloadStatus = () => status;
export function setDownloadStatus(value: DownloadStatus) {
  downloadCountdown.stop();
  status = value;
  if (value.phase === 'complete') downloadCountdown.start();
  for (const listener of listeners) listener();
}
export function setDownloadRetry(callback?: () => void) {
  retry = callback;
}
export const retryOfflineDownload = () => retry?.();
export function useDownloadStatus() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getDownloadStatus);
}

export function setDownloadRefresh(callback?: (scope: ProgramScope) => void) {
  refresh = callback;
}
export const refreshOfflineProgram = (scope: ProgramScope) => refresh?.(scope);
