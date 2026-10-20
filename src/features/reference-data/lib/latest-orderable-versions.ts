import type { Orderable } from '@/features/reference-data/lib/types';

const versionOf = (orderable: Orderable) => orderable.meta?.versionNumber ?? 0;

export function latestOrderableVersions(orderables: readonly Orderable[]) {
  const latest = new Map<string, Orderable>();
  for (const orderable of orderables) {
    const kept = latest.get(orderable.id);
    if (!kept || versionOf(orderable) > versionOf(kept)) latest.set(orderable.id, orderable);
  }
  return [...latest.values()];
}
