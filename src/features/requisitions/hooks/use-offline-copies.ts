import { useQuery, useQueryClient } from '@tanstack/react-query';
import { liveQuery } from 'dexie';
import { createContext, useEffect } from 'react';
import { type RequisitionCopy, readCopies } from '@/features/requisitions/lib/offline-copies';
import { isSecureOrigin } from '@/lib/secure-context';
import { getSessionScope, useSessionScope } from '@/lib/session-scope';

export const RequisitionCopiesContext = createContext<RequisitionCopy[] | undefined>(undefined);
export const COPIES_KEY = ['requisition-copies'] as const;
export const LOCAL_LIST_KEY = ['requisition-local-list'] as const;
export function useOfflineCopies() {
  const scope = useSessionScope();
  const client = useQueryClient();
  useEffect(() => {
    if (!isSecureOrigin) return;
    const subscription = liveQuery(readCopies).subscribe({
      next: () => {
        if (scope !== getSessionScope()) return;
        void client.invalidateQueries({ queryKey: COPIES_KEY });
        void client.invalidateQueries({ queryKey: LOCAL_LIST_KEY });
      },
      error: () => {
        if (scope === getSessionScope()) void client.invalidateQueries({ queryKey: COPIES_KEY });
      },
    });
    return () => subscription.unsubscribe();
  }, [client, scope]);
  const query = useQuery({
    queryKey: COPIES_KEY,
    queryFn: () => (isSecureOrigin ? readCopies() : Promise.resolve([])),
    staleTime: Infinity,
  });
  if (query.error) throw query.error;
  return query.data;
}
