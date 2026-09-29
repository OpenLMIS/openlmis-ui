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

// Subscribing now, not on first render, makes Query listen for the browser's events from the start.
onlineManager.subscribe((online) => {
  clearTimeout(backOnlineTimer);
  setBackOnline(online);
  if (online) backOnlineTimer = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
});

/** Query only hears `online`/`offline` events, so an app opened offline thinks it is online. */
export function seedOnline() {
  onlineManager.setOnline(navigator.onLine);
}

export const isOnline = () => onlineManager.isOnline();

/** Whether the browser has a connection, following it as it comes and goes. */
export function useOnline() {
  return useSyncExternalStore((onChange) => onlineManager.subscribe(onChange), isOnline);
}

/** Runs `callback` each time the connection comes back. */
export function useOnReconnect(callback: () => void) {
  const run = useEffectEvent(callback);
  useEffect(() => onlineManager.subscribe((online) => online && run()), []);
}

export const dismissBackOnline = () => {
  clearTimeout(backOnlineTimer);
  setBackOnline(false);
};

/** True for a few seconds after the connection comes back. */
export function useBackOnline() {
  return useSyncExternalStore(
    (onChange) => {
      backOnlineListeners.add(onChange);
      return () => backOnlineListeners.delete(onChange);
    },
    () => backOnline,
  );
}
