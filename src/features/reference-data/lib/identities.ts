import type { OrderableIdentity } from '@/features/reference-data/api/api';

export function uniqueIdentities(identities: readonly OrderableIdentity[], sort = false) {
  const unique = [
    ...new Map(identities.map((item) => [`${item.id}|${item.versionNumber}`, item])).values(),
  ];
  return sort
    ? unique.sort((a, b) => a.id.localeCompare(b.id) || a.versionNumber - b.versionNumber)
    : unique;
}
