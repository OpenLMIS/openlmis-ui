import { useSyncExternalStore } from 'react';
import { Workbox } from 'workbox-window';
import { SUPPORTED_LANGUAGES } from '@/lib/config';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

type Options = {
  enabled?: boolean;
  reload?: () => void;
};

let workbox: Workbox | undefined;
let reloadPage = () => window.location.reload();
let updateReady = false;
const listeners = new Set<() => void>();

function setUpdateReady(ready: boolean) {
  updateReady = ready;
  for (const listener of listeners) listener();
}

const isOurs = (controller: ServiceWorker | null) =>
  controller?.scriptURL === new URL(`${import.meta.env.BASE_URL}sw.js`, location.origin).href;

function warmOfflineFiles() {
  if (!isOurs(navigator.serviceWorker.controller)) return;
  const base = import.meta.env.BASE_URL;
  const locales = SUPPORTED_LANGUAGES.map(({ code }) => `${base}locales/${code}.json`);
  for (const url of [`${base}config.json`, ...locales]) void fetch(url).catch(() => {});
}

export function registerServiceWorker({ enabled = import.meta.env.PROD, reload }: Options = {}) {
  if (!enabled || workbox || !('serviceWorker' in navigator)) return;
  if (reload) reloadPage = reload;
  const base = import.meta.env.BASE_URL;
  workbox = new Workbox(`${base}sw.js`, { scope: base });
  workbox.addEventListener('waiting', () => setUpdateReady(true));
  void workbox.register().then((registration) => {
    if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS);
  });
  warmOfflineFiles();
  navigator.serviceWorker.addEventListener('controllerchange', warmOfflineFiles);
}

export async function applyUpdate() {
  const registration = await navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL);
  if (!workbox || !registration?.waiting) {
    reloadPage();
    return;
  }
  workbox.addEventListener('controlling', () => reloadPage());
  workbox.messageSkipWaiting();
}

export const dismissUpdate = () => setUpdateReady(false);

export function useUpdateReady() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => updateReady,
  );
}
