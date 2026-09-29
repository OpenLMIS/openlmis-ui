import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Query only hears `online`/`offline` events, so an app opened offline thinks it is online. */
export function seedOnline() {
  onlineManager.setOnline(navigator.onLine);
}

export const isOnline = () => onlineManager.isOnline();

/** Whether the browser has a connection, following it as it comes and goes. */
export function useOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    isOnline,
    () => true,
  );
}
