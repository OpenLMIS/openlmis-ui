import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { SessionEndedError } from '@/features/auth/lib/session';
import type {
  DownloadAcceptance,
  DownloadProvider,
  DownloadRecord,
  DownloadScope,
} from '@/lib/download-provider';
import { reportCaughtError } from '@/lib/report-error';
import { getSessionScope, useSessionScope } from '@/lib/session-scope';

const EMPTY_SCOPES = new Set<string>();

export function useDownloadedScopes<R extends DownloadRecord, S extends DownloadScope>(
  provider: DownloadProvider<R, S>,
  scopes: readonly DownloadScope[],
  { enabled, accepts }: { enabled: boolean; accepts: DownloadAcceptance<R, S> },
) {
  const session = useSessionScope();
  const key = JSON.stringify([
    session,
    enabled,
    provider.id,
    scopes.map((scope) => [scope.id, scope.key]),
  ]);
  const [ready, setReady] = useState({ key: '', ids: EMPTY_SCOPES });
  useEffect(() => {
    if (!enabled) return;
    const subscription = liveQuery(async () => {
      const results = await Promise.all(
        scopes.map(async (scope) => ((await provider.readScope(scope, accepts)) ? scope.id : null)),
      );
      return new Set(results.filter((id) => id !== null));
    }).subscribe({
      next: (ids) => setReady({ key, ids }),
      error: (error) => {
        if (error instanceof SessionEndedError || session !== getSessionScope()) return;
        reportCaughtError(error, {});
        setReady({ key, ids: EMPTY_SCOPES });
      },
    });
    return () => subscription.unsubscribe();
  }, [key, provider, scopes, enabled, accepts, session]);
  return enabled && ready.key === key ? ready.ids : EMPTY_SCOPES;
}
