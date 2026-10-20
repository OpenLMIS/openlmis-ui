import type { IndexableType } from 'dexie';
import type { ParseKeys } from 'i18next';
import type { OfflineAccess } from '@/lib/offline-access';

export type DownloadRecord = {
  userId: string;
  generation: string;
  fetchedAt: number;
  stale?: boolean;
};
export type DownloadScope = {
  id: string;
  name: string;
  key: IndexableType;
  refreshKey?: string;
};
export type DownloadTask = DownloadScope & {
  fetch: (signal: AbortSignal) => Promise<DownloadRecord>;
  isFresh: (record: DownloadRecord | undefined) => boolean;
};
export type DownloadProvider = {
  id: string;
  label: ParseKeys;
  table: string;
  pages?: readonly string[];
  eligible: (access: OfflineAccess) => boolean;
  tasks: (access: OfflineAccess) => DownloadTask[];
};

export function defineDownloadProvider<S extends DownloadScope, R extends DownloadRecord>(spec: {
  id: string;
  label: ParseKeys;
  table: string;
  pages?: readonly string[];
  eligible: (access: OfflineAccess) => boolean;
  scopes: (access: OfflineAccess) => S[];
  fetch: (scope: S, signal: AbortSignal) => Promise<R>;
  isFresh: (record: R | undefined, access: OfflineAccess, scope: S) => boolean;
  accepts: (record: R, access: OfflineAccess, scope: S) => boolean;
}): DownloadProvider {
  return {
    id: spec.id,
    label: spec.label,
    table: spec.table,
    pages: spec.pages,
    eligible: spec.eligible,
    tasks: (access) =>
      spec.scopes(access).map((scope) => ({
        ...scope,
        async fetch(signal) {
          const record = await spec.fetch(scope, signal);
          if (record.userId !== access.userId || !spec.accepts(record, access, scope))
            throw new Error('Downloaded dataset scope mismatch');
          return record;
        },
        isFresh: (record) => spec.isFresh(record as R | undefined, access, scope),
      })),
  };
}

export function downloadProviders(providers: readonly DownloadProvider[]) {
  const ids = new Set<string>();
  for (const provider of providers) {
    if (ids.has(provider.id)) throw new Error(`Duplicate download provider: ${provider.id}`);
    ids.add(provider.id);
  }
  return [...providers];
}
