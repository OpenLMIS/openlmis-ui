import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { getLocalDb } from '@/integrations/local-db';
import type { AdjustmentBundle } from '@/lib/adjustment-bundle';
import { assertSessionScope, useSessionScope } from '@/lib/session-scope';

export function useAdjustmentReadiness(facilityId: string | undefined) {
  const scope = useSessionScope();
  const [result, setResult] = useState<{
    scope: number;
    facilityId?: string;
    bundles: AdjustmentBundle[];
    error?: unknown;
  }>();
  useEffect(() => {
    if (!facilityId) return;
    const sessionScope = scope;
    const db = getLocalDb();
    const subscription = liveQuery(async () => {
      const bundles = await db.table<AdjustmentBundle>('adjustmentDownloads').toArray();
      assertSessionScope(sessionScope);
      return bundles.filter(
        (bundle) => bundle.facilityId === facilityId && bundle.formatVersion === 1,
      );
    }).subscribe({
      next: (bundles) => setResult({ scope: sessionScope, facilityId, bundles }),
      error: (error) => setResult({ scope: sessionScope, facilityId, bundles: [], error }),
    });
    return () => subscription.unsubscribe();
  }, [facilityId, scope]);
  if (result?.scope !== scope || result?.facilityId !== facilityId) return [];
  if (result.error) throw result.error;
  return result.bundles;
}
