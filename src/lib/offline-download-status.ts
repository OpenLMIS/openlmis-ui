import type { ParseKeys } from 'i18next';
import { create } from 'zustand';
import { createNoticeCountdown } from '@/lib/notice-countdown';

export type DownloadEntry = { id: string; name: string; dataset: string; datasetLabel: ParseKeys };
export type DownloadStatus = {
  phase: 'idle' | 'running' | 'complete' | 'failed' | 'unsupported';
  incomplete: DownloadEntry[];
  reason?: 'timeout' | 'offline' | 'session' | 'read';
  accessFailed?: boolean;
  trigger?: 'sign-in' | 'boot' | 'force' | 'retry' | 'refresh' | 'access';
};
const idle: DownloadStatus = { phase: 'idle', incomplete: [] };
const useStatus = create(() => ({ status: idle }));
let retry: (() => void) | undefined;
export const downloadCountdown = createNoticeCountdown(() => setDownloadStatus(idle));
export const getDownloadStatus = () => useStatus.getState().status;
export function setDownloadStatus(status: DownloadStatus) {
  downloadCountdown.stop();
  useStatus.setState({ status });
  if (status.phase === 'complete') downloadCountdown.start();
}
export function setDownloadRetry(callback?: () => void) {
  retry = callback;
}
export const retryOfflineDownload = () => retry?.();
export const useDownloadStatus = () => useStatus((state) => state.status);
