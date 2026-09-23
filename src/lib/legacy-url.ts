// The legacy UI shares this app's origin; in dev it is the instance the API proxy points at.
const LEGACY_ORIGIN = import.meta.env.DEV ? (import.meta.env.VITE_API_PROXY_TARGET ?? '') : '';

/** A page of the legacy UI, for screens not migrated yet, e.g. `legacyUrl('requisitions/approvalList')`. */
export function legacyUrl(route: string): string {
  return `${LEGACY_ORIGIN.replace(/\/+$/, '')}/#!/${route.replace(/^\/+/, '')}`;
}
