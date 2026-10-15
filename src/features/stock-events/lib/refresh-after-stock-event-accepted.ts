import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/key-factory';
import { refreshOfflineProgram } from '@/lib/offline-download-status';

export function refreshAfterStockEventAccepted(
  queryClient: QueryClient,
  event: { facilityId: string; programId: string },
) {
  refreshOfflineProgram(event);
  for (const queryKey of [
    queryKeys.stockEvents.all,
    queryKeys.stockCards.all,
    queryKeys.stockCardSummaries.all,
  ])
    void queryClient.invalidateQueries({ queryKey });
}
