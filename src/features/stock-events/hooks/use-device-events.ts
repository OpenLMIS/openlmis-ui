import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import { getLocalDb } from '@/integrations/local-db';
import { assertSessionScope, getSessionScope, useSessionScope } from '@/lib/session-scope';

export function useDeviceEvents(enabled = true) {
  const scope = useSessionScope();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    scope: number;
    attempt: number;
    events?: QueuedStockEvent[];
    error?: unknown;
  }>({ scope, attempt: 0 });
  useEffect(() => {
    if (!enabled) return;
    const subscription = liveQuery(async () => {
      assertSessionScope(scope);
      const events = await getLocalDb()
        .table<QueuedStockEvent>('stockEventQueue')
        .orderBy('sequence')
        .toArray();
      assertSessionScope(scope);
      return events;
    }).subscribe({
      next: (events) => {
        if (scope === getSessionScope()) setState({ scope, attempt: retry, events });
      },
      error: (error: unknown) => {
        if (scope === getSessionScope()) setState({ scope, attempt: retry, error });
      },
    });
    return () => subscription.unsubscribe();
  }, [enabled, scope, retry]);
  return {
    events: enabled && state.scope === scope && state.attempt === retry ? state.events : undefined,
    error: enabled && state.scope === scope && state.attempt === retry ? state.error : undefined,
    retry: () => setRetry((value) => value + 1),
  };
}
