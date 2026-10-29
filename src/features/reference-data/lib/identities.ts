import type { OrderableIdentity } from '@/features/reference-data/api/api';

export function uniqueIdentities(identities: readonly OrderableIdentity[], sort = false) {
  const unique = [
    ...new Map(
      identities.map(({ id, versionNumber }) => [`${id}|${versionNumber}`, { id, versionNumber }]),
    ).values(),
  ];
  return sort
    ? unique.sort((a, b) => a.id.localeCompare(b.id) || a.versionNumber - b.versionNumber)
    : unique;
}
