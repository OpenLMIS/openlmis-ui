import { onlineManager } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useSyncExternalStore } from 'react';

const BACK_ONLINE_MS = 4000;

let backOnline = false;
let backOnlineTimer: ReturnType<typeof setTimeout> | undefined;
const backOnlineListeners = new Set<() => void>();

function setBackOnline(value: boolean) {
  backOnline = value;
  for (const listener of backOnlineListeners) listener();
}

onlineManager.subscribe((online) => {
  clearTimeout(backOnlineTimer);
  setBackOnline(online);
  if (online) backOnlineTimer = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
});

export function seedOnline() {
  onlineManager.setOnline(navigator.onLine);
}

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
