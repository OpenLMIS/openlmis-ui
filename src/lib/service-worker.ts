import { useSyncExternalStore } from 'react';
import { Workbox } from 'workbox-window';
import { SUPPORTED_LANGUAGES } from '@/lib/config';

const UPDATE_CHECK_MS = 60 * 60 * 1000;
const ACTIVATION_TIMEOUT_MS = 3000;

type Options = {
  enabled?: boolean;
  reload?: () => void;
};

let workbox: Workbox | undefined;
let reloadPage = () => window.location.reload();
let updateReady = false;
let activeWorker: ServiceWorker | null = null;

export const canReloadIntoWorker = () =>
  isOurs(activeWorker) && activeWorker?.state !== 'redundant';
const listeners = new Set<() => void>();

function markUpdateReady() {
  updateReady = true;
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

function watchForUpdates(registration: ServiceWorkerRegistration) {
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed' && isOurs(navigator.serviceWorker.controller)) {
        markUpdateReady();
      }
    });
  });
}

export function registerServiceWorker({ enabled = import.meta.env.PROD, reload }: Options = {}) {
  if (!enabled || workbox || !('serviceWorker' in navigator)) return;
  if (reload) reloadPage = reload;
  const base = import.meta.env.BASE_URL;
  workbox = new Workbox(`${base}sw.js`, { scope: base });
  workbox.addEventListener('activated', (event) => {
    if (isOurs(event.sw ?? null)) activeWorker = event.sw ?? null;
  });
  workbox.addEventListener('waiting', () => markUpdateReady());
  void workbox.register().then((registration) => {
    if (!registration) return;
    activeWorker = registration.active;
    watchForUpdates(registration);
    setInterval(() => void registration.update(), UPDATE_CHECK_MS);
  });
  warmOfflineFiles();
  navigator.serviceWorker.addEventListener('controllerchange', warmOfflineFiles);
}

export async function applyUpdate(beforeReload: () => void = () => {}) {
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    beforeReload();
    reloadPage();
  };
  const registration = await navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL);
  const waiting = registration?.waiting;
  if (!waiting) {
    reload();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
  setTimeout(reload, ACTIVATION_TIMEOUT_MS);
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function useUpdateReady() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => updateReady,
  );
}
