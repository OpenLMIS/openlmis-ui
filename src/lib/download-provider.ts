import type { IndexableType } from 'dexie';
import type { ParseKeys } from 'i18next';
import { type LocalTableName, localTable } from '@/integrations/local-db';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { type OfflineAccess, readOfflineAccess } from '@/lib/offline-access';
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
export type DownloadAcceptance<R, S> = (record: R, access: OfflineAccess, scope: S) => boolean;

export type DownloadProvider<
  R extends DownloadRecord = DownloadRecord,
  S extends DownloadScope = DownloadScope,
> = {
  id: string;
  label: ParseKeys;
  table: LocalTableName;
  tasks: (access: OfflineAccess) => DownloadTask[];
  readScope(scope: DownloadScope, accepts?: DownloadAcceptance<R, S>): Promise<boolean>;
};

export function defineDownloadProvider<S extends DownloadScope, R extends DownloadRecord>(spec: {
  id: string;
  label: ParseKeys;
  table: LocalTableName;
  scopes: (access: OfflineAccess) => S[];
  fetch: (scope: S, signal: AbortSignal) => Promise<R>;
  isFresh: (record: R | undefined, access: OfflineAccess, scope: S) => boolean;
  accepts: (record: R, access: OfflineAccess, scope: S) => boolean;
}): DownloadProvider<R, S> {
  return {
    id: spec.id,
    label: spec.label,
    table: spec.table,
    async readScope(scope, accepts = spec.accepts) {
      const session = getSessionScope();
      let access: OfflineAccess;
      try {
        access = await readOfflineAccess();
      } catch (error) {
        assertSessionScope(session);
        if (error instanceof LocalDataUnavailableError) return false;
        throw error;
      }
      assertSessionScope(session);
      const eligible = spec
        .scopes(access)
        .find((candidate) => JSON.stringify(candidate.key) === JSON.stringify(scope.key));
      if (!eligible) return false;
      const record = await localTable<R>(spec.table).get(scope.key);
      assertSessionScope(session);
      return !!record && record.userId === access.userId && accepts(record, access, eligible);
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
