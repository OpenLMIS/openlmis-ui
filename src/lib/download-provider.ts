import type { IndexableType } from 'dexie';
import type { ParseKeys } from 'i18next';
import {
  getLocalDbUserId,
  LOCAL_TABLES,
  type LocalTableName,
  localTable,
} from '@/integrations/local-db';
import type { OfflineAccess } from '@/lib/offline-access';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

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
  table: LocalTableName;
  tasks: (access: OfflineAccess) => DownloadTask[];
  readScope: (scope: DownloadScope) => Promise<boolean>;
};

export function defineDownloadProvider<S extends DownloadScope, R extends DownloadRecord>(spec: {
  id: string;
  label: ParseKeys;
  table: LocalTableName;
  scopes: (access: OfflineAccess) => S[];
  fetch: (scope: S, signal: AbortSignal) => Promise<R>;
  isFresh: (record: R | undefined, access: OfflineAccess, scope: S) => boolean;
  accepts: (record: R, access: OfflineAccess, scope: S) => boolean;
}): DownloadProvider {
  return {
    id: spec.id,
    label: spec.label,
    table: spec.table,
    async readScope(scope) {
      const session = getSessionScope();
      const userId = getLocalDbUserId();
      const access = await localTable<OfflineAccess>(LOCAL_TABLES.offlineAccess).get(userId);
      assertSessionScope(session);
      if (!access || access.userId !== userId || access.formatVersion !== 1) return false;
      const eligible = spec
        .scopes(access)
        .find((candidate) => JSON.stringify(candidate.key) === JSON.stringify(scope.key));
      if (!eligible) return false;
      const record = await localTable<R>(spec.table).get(scope.key);
      assertSessionScope(session);
      return !!record && record.userId === userId && spec.accepts(record, access, eligible);
    },
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
