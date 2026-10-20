const CHUNK_LOAD_FAILURES = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'Unable to preload CSS',
];

export const isChunkLoadError = (error: unknown) =>
  error instanceof Error && CHUNK_LOAD_FAILURES.some((text) => error.message.includes(text));

const RELOADED_AT = 'openlmis-ui:chunk-reload';
const RELOAD_GUARD_MS = 30_000;

export function reloadOnce(reload: () => void) {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_AT)) < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return false;
  }
  reload();
  return true;
}
