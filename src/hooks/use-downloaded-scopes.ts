import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'react';
import { SessionEndedError } from '@/features/auth/lib/session';
import type {
  DownloadAcceptance,
  DownloadProvider,
  DownloadRecord,
  DownloadScope,
  DownloadScopeState,
} from '@/lib/download-provider';
import { reportCaughtError } from '@/lib/report-error';
import { getSessionScope, useSessionScope } from '@/lib/session-scope';

const EMPTY_SCOPES = new Map<string, DownloadScopeState>();

export function useDownloadedScopes<R extends DownloadRecord, S extends DownloadScope>(
  provider: DownloadProvider<R, S>,
  scopes: readonly DownloadScope[],
  { enabled, accepts }: { enabled: boolean; accepts: DownloadAcceptance<R, S> },
): { loaded: boolean; states: ReadonlyMap<string, DownloadScopeState> } {
  const session = useSessionScope();
  const key = JSON.stringify([
    session,
    enabled,
    provider.id,
    scopes.map((scope) => [scope.id, scope.key]),
  ]);
  const [ready, setReady] = useState({ key: '', states: EMPTY_SCOPES });
  useEffect(() => {
    if (!enabled) return;
    const subscription = liveQuery(async () => {
      const results = await Promise.all(
        scopes.map(
          async (scope) => [scope.id, await provider.readScopeState(scope, accepts)] as const,
        ),
      );
      return new Map(results);
    }).subscribe({
      next: (states) => setReady({ key, states }),
      error: (error) => {
        if (error instanceof SessionEndedError || session !== getSessionScope()) return;
        reportCaughtError(error, {});
        setReady({ key, states: EMPTY_SCOPES });
      },
    });
    return () => subscription.unsubscribe();
  }, [key, provider, scopes, enabled, accepts, session]);
  const loaded = enabled && ready.key === key;
  return useMemo(
    () => ({ loaded, states: loaded ? ready.states : EMPTY_SCOPES }),
    [loaded, ready.states],
  );
}
