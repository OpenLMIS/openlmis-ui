import { useSyncExternalStore } from 'react';

export type DownloadStatus = {
  phase: 'idle' | 'running' | 'complete' | 'failed' | 'unsupported';
  failed: { id: string; name: string }[];
  reason?: 'timeout' | 'offline' | 'session' | 'read';
  accessFailed?: boolean;
};
const idle: DownloadStatus = { phase: 'idle', failed: [] };
let status = idle;
const listeners = new Set<() => void>();
let retry: (() => void) | undefined;
export const getDownloadStatus = () => status;
export function setDownloadStatus(value: DownloadStatus) {
  status = value;
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
