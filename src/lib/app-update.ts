/** Reloads into the new version once its worker controls the page, which the plugin can miss. */
export function reloadWhenUpdated(reload = () => window.location.reload()) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
}
