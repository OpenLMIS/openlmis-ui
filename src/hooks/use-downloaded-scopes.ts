import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import type { DownloadProvider, DownloadScope } from '@/lib/download-provider';
import { reportCaughtError } from '@/lib/report-error';
import { useSessionScope } from '@/lib/session-scope';

export function useDownloadedScopes(provider: DownloadProvider, scopes: readonly DownloadScope[]) {
  const session = useSessionScope();
  const key = JSON.stringify([session, provider.id, scopes.map((scope) => [scope.id, scope.key])]);
  const [ready, setReady] = useState({ key: '', ids: new Set<string>() });
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const results = await Promise.all(
        scopes.map(async (scope) => ((await provider.readScope(scope)) ? scope.id : null)),
      );
      return new Set(results.filter((id) => id !== null));
    }).subscribe({
      next: (ids) => setReady({ key, ids }),
      error: (error) => {
        reportCaughtError(error, {});
        setReady({ key, ids: new Set() });
      },
    });
    return () => subscription.unsubscribe();
  }, [key, provider, scopes]);
  return ready.key === key ? ready.ids : new Set<string>();
}
