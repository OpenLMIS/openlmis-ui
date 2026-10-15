import { onlineManager } from '@tanstack/react-query';
import { AxiosError, isAxiosError } from 'axios';
import { useEffect, useEffectEvent, useSyncExternalStore } from 'react';

const BACK_ONLINE_MS = 4000;

let unreachable = false;
let probeTimer: ReturnType<typeof setTimeout> | undefined;
let probeController: AbortController | undefined;
let probeDelay = 1000;

function scheduleProbe(delay = probeDelay) {
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
      if (response.ok && !controller.signal.aborted && navigator.onLine) {
        onlineManager.setOnline(true);
        return;
      }
    } catch {
    } finally {
      clearTimeout(timeout);
      if (probeController === controller) probeController = undefined;
    }
    probeDelay = Math.min(probeDelay * 2, 30000);
    scheduleProbe();
  }, delay);
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
let backOnlineTimer: ReturnType<typeof setTimeout> | undefined;
const backOnlineListeners = new Set<() => void>();

function setBackOnline(value: boolean) {
  backOnline = value;
  for (const listener of backOnlineListeners) listener();
}

onlineManager.subscribe((online) => {
  if (online) {
    connectionGeneration += 1;
    unreachable = false;
    probeDelay = 1000;
    clearTimeout(probeTimer);
    probeTimer = undefined;
    probeController?.abort();
  }
  clearTimeout(backOnlineTimer);
  setBackOnline(online);
  if (online) backOnlineTimer = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
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
  clearTimeout(backOnlineTimer);
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
