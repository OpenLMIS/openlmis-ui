import { SUPPORTED_LANGUAGES } from '@/lib/config';

const base = import.meta.env.BASE_URL;

/** Fetched once our worker controls the page, so it has them to answer with offline. */
const OFFLINE_FILES = [
  `${base}config.json`,
  ...SUPPORTED_LANGUAGES.map(({ code }) => `${base}locales/${code}.json`),
];

// The legacy UI's worker, scoped to the whole origin, can control this page before ours does.
const isOurs = (controller: ServiceWorker | null) =>
  controller?.scriptURL === new URL(`${base}sw.js`, location.origin).href;

/** Every language and the runtime config, cached after one visit rather than only those used. */
export function warmOfflineCache() {
  if (!('serviceWorker' in navigator)) return;
  const { serviceWorker } = navigator;
  const warm = () => {
    if (!isOurs(serviceWorker.controller)) return;
    for (const url of OFFLINE_FILES) void fetch(url).catch(() => {});
  };
  warm();
  serviceWorker.addEventListener('controllerchange', warm);
}
