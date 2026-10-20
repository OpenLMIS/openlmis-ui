import { matchesOfflinePage } from '@/lib/offline-capability';

const rights = new Set<string>();
const pages = new Set<string>(['/home', '/offline-events']);
export function registerOfflinePages(
  paths: readonly string[],
  requiredRights: readonly string[] = [],
) {
  for (const path of paths) pages.add(path);
  for (const right of requiredRights) rights.add(right);
}
export const isOfflineCapable = (pathname: string) => matchesOfflinePage(pathname, [...pages]);
export const hasOfflineCapability = (userRights: ReadonlySet<string> | undefined) =>
  [...rights].some((right) => userRights?.has(right));
