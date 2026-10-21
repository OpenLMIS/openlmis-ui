import { onlineManager } from '@tanstack/react-query';
import { AxiosError, isAxiosError } from 'axios';
import { useEffect, useEffectEvent, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createNoticeCountdown } from '@/lib/notice-countdown';

let unreachable = false;
let failureGeneration = 0;
export const getConnectionFailureGeneration = () => failureGeneration;
let authProbeUrl: string | undefined;
let probeTimer: ReturnType<typeof setTimeout> | undefined;
let probeController: AbortController | undefined;
let probeDelay = 1000;

function stopProbing() {
  authProbeUrl = undefined;
  unreachable = false;
  clearTimeout(probeTimer);
  probeTimer = undefined;
  probeController?.abort();
  probeController = undefined;
}

function markUnreachable() {
  unreachable = true;
  onlineManager.setOnline(false);
  scheduleProbe();
}

function scheduleProbe(delay = probeDelay) {
  if (delay === 0) {
    clearTimeout(probeTimer);
    probeTimer = undefined;
  }
  if (!unreachable || probeTimer || probeController || !navigator.onLine) return;
  probeTimer = setTimeout(async () => {
    probeTimer = undefined;
    const controller = new AbortController();
    probeController = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    probeDelay = Math.min(probeDelay * 2, 30000);
    try {
      const authUrl = authProbeUrl;
      const response = await fetch(authUrl ?? '/localeSettings', {
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      });
      const data: unknown = await response.json();
      const expected =
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data) &&
        (authUrl
          ? [400, 401, 405].includes(response.status) &&
            'error' in data &&
            typeof data.error === 'string'
          : response.ok &&
            'timeZoneId' in data &&
            typeof data.timeZoneId === 'string' &&
            !!data.timeZoneId.trim());
      if (expected && authUrl === authProbeUrl && !controller.signal.aborted && navigator.onLine) {
        onlineManager.setOnline(true);
        return;
      }
    } catch {
      // A probe never replaces the current offline state on failure.
    } finally {
      clearTimeout(timeout);
      if (probeController === controller) probeController = undefined;
      if (unreachable) scheduleProbe();
    }
  }, delay);
}

export function reportConnectionSuccess(url?: string, sentGeneration = failureGeneration) {
  if (sentGeneration !== failureGeneration) return;
  if (authProbeUrl && url !== undefined && !url.includes('/oauth/')) return;
  // Only API success resets backoff; a probe can recover while the API still fails.
  probeDelay = 1000;
  stopProbing();
  if (navigator.onLine) onlineManager.setOnline(true);
}

export function reportConnectionFailure(error: unknown) {
  if (
    !isAxiosError(error) ||
    error.response ||
    error.code === AxiosError.ERR_CANCELED ||
    (error.code === AxiosError.ECONNABORTED && !error.config?.url?.includes('/oauth/'))
  )
    return;
  failureGeneration += 1;
  if (error.config?.url?.includes('/oauth/')) {
    authProbeUrl = `${(error.config.baseURL ?? '/api').replace(/\/$/, '')}/oauth/token`;
  }
  markUnreachable();
}

onlineManager.setEventListener((setOnline) => {
  const online = () => {
    if (unreachable) scheduleProbe(0);
    else setOnline(true);
  };
  const offline = () => setOnline(false);
  window.addEventListener('online', online);
  window.addEventListener('offline', offline);
  return () => {
    window.removeEventListener('online', online);
    window.removeEventListener('offline', offline);
  };
});

let connectionGeneration = 0;
export const getConnectionGeneration = () => connectionGeneration;

const useBackOnlineStore = create(() => ({ backOnline: false }));
export const backOnlineCountdown = createNoticeCountdown(() => setBackOnline(false));
const setBackOnline = (backOnline: boolean) => useBackOnlineStore.setState({ backOnline });

onlineManager.subscribe((online) => {
  if (online) {
    connectionGeneration += 1;
    stopProbing();
  }
  backOnlineCountdown.stop();
  setBackOnline(online);
  if (online) backOnlineCountdown.start();
});

export function seedOnline() {
  if (unreachable) scheduleProbe(0);
  else onlineManager.setOnline(navigator.onLine);
}

export const continueOffline = markUnreachable;

export const isOnline = () => onlineManager.isOnline();

export function useOnline() {
  return useSyncExternalStore((onChange) => onlineManager.subscribe(onChange), isOnline);
}

export function useOnReconnect(callback: () => void) {
  const run = useEffectEvent(callback);
  useEffect(() => onlineManager.subscribe((online) => online && run()), []);
}

export const dismissBackOnline = () => {
  backOnlineCountdown.stop();
  setBackOnline(false);
};

export const useBackOnline = () => useBackOnlineStore((state) => state.backOnline);

export function useOnConnectivityChange(callback: (online: boolean) => void) {
  const run = useEffectEvent(callback);
  useEffect(() => onlineManager.subscribe((online) => run(online)), []);
}
