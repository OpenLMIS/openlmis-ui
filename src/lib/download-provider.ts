import type { IndexableType } from 'dexie';
import type { ParseKeys } from 'i18next';
import { type LocalTableName, localTable } from '@/integrations/local-db';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { type OfflineAccess, readOfflineAccess } from '@/lib/offline-access';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export type DownloadRefreshTrigger = 'sign-in' | 'periodic' | 'force' | 'accepted';
export type DownloadScopeState = 'ready' | 'ineligible' | 'missing' | 'outdated';

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
  isComplete: (record: DownloadRecord | undefined) => boolean;
};
export type DownloadAcceptance<R, S> = (record: R, access: OfflineAccess, scope: S) => boolean;

export type DownloadProvider<
  R extends DownloadRecord = DownloadRecord,
  S extends DownloadScope = DownloadScope,
> = {
  id: string;
  label: ParseKeys;
  table: LocalTableName;
  refreshOn: readonly DownloadRefreshTrigger[];
  tasks: (access: OfflineAccess) => DownloadTask[];
  readScopeState(
    scope: DownloadScope,
    accepts?: DownloadAcceptance<R, S>,
  ): Promise<DownloadScopeState>;
};

export function defineDownloadProvider<S extends DownloadScope, R extends DownloadRecord>(spec: {
  id: string;
  label: ParseKeys;
  table: LocalTableName;
  refreshOn: readonly DownloadRefreshTrigger[];
  scopes: (access: OfflineAccess) => S[];
  fetch: (scope: S, signal: AbortSignal) => Promise<R>;
  isFresh: (record: R | undefined, access: OfflineAccess, scope: S) => boolean;
  accepts: (record: R, access: OfflineAccess, scope: S) => boolean;
}): DownloadProvider<R, S> {
  return {
    id: spec.id,
    label: spec.label,
    table: spec.table,
    refreshOn: spec.refreshOn,
    async readScopeState(scope, accepts = spec.accepts) {
      const session = getSessionScope();
      let access: OfflineAccess;
      try {
        access = await readOfflineAccess();
      } catch (error) {
        assertSessionScope(session);
        if (error instanceof LocalDataUnavailableError) return 'missing';
        throw error;
      }
      assertSessionScope(session);
      const eligible = spec
        .scopes(access)
        .find((candidate) => JSON.stringify(candidate.key) === JSON.stringify(scope.key));
      if (!eligible) return 'ineligible';
      const record = await localTable<R>(spec.table).get(scope.key);
      assertSessionScope(session);
      if (!record || record.userId !== access.userId) return 'missing';
      return accepts(record, access, eligible) ? 'ready' : 'outdated';
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
        isComplete: (record) =>
          !!record && record.userId === access.userId && spec.accepts(record as R, access, scope),
        isFresh: (record) => spec.isFresh(record as R | undefined, access, scope),
      })),
  };
}
