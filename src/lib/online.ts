import { onlineManager } from '@tanstack/react-query';
import { AxiosError, isAxiosError } from 'axios';
import { useEffect, useEffectEvent, useSyncExternalStore } from 'react';
import { createNoticeCountdown } from '@/lib/notice-countdown';

let unreachable = false;
let probeTimer: ReturnType<typeof setTimeout> | undefined;
let probeController: AbortController | undefined;
let probeDelay = 1000;

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
    try {
      const response = await fetch('/localeSettings', {
        cache: 'no-store',
        signal: controller.signal,
      });
      probeDelay = Math.min(probeDelay * 2, 30000);
      if (response.ok && !controller.signal.aborted && navigator.onLine) {
        onlineManager.setOnline(true);
        return;
      }
    } catch {
      probeDelay = Math.min(probeDelay * 2, 30000);
    } finally {
      clearTimeout(timeout);
      if (probeController === controller) probeController = undefined;
      if (unreachable) scheduleProbe();
    }
  }, delay);
}

export function reportConnectionSuccess() {
  probeDelay = 1000;
}

export function reportConnectionFailure(error: unknown) {
  if (
    !isAxiosError(error) ||
    error.response ||
    error.code === AxiosError.ERR_CANCELED ||
    error.code === AxiosError.ECONNABORTED
  )
    return;
  unreachable = true;
  onlineManager.setOnline(false);
  scheduleProbe();
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

let backOnline = false;
export const backOnlineCountdown = createNoticeCountdown(() => setBackOnline(false));
const backOnlineListeners = new Set<() => void>();

function setBackOnline(value: boolean) {
  backOnline = value;
  for (const listener of backOnlineListeners) listener();
}

onlineManager.subscribe((online) => {
  if (online) {
    connectionGeneration += 1;
    unreachable = false;
    clearTimeout(probeTimer);
    probeTimer = undefined;
    probeController?.abort();
  }
  backOnlineCountdown.stop();
  setBackOnline(online);
  if (online) backOnlineCountdown.start();
});

export function seedOnline() {
  if (unreachable) scheduleProbe(0);
  else onlineManager.setOnline(navigator.onLine);
}

export const continueOffline = () => {
  unreachable = true;
  onlineManager.setOnline(false);
  scheduleProbe();
};

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

export function useBackOnline() {
  return useSyncExternalStore(
    (onChange) => {
      backOnlineListeners.add(onChange);
      return () => backOnlineListeners.delete(onChange);
    },
    () => backOnline,
  );
}
