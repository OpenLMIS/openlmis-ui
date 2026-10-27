import type { QueryClient } from '@tanstack/react-query';
import { getLocalDb } from '@/integrations/local-db';
import { queryKeys } from '@/lib/key-factory';
import { randomId } from '@/lib/random-id';
import { getSessionScope, getSessionUserId, subscribeSessionScope } from '@/lib/session-scope';

type AcceptedScope = { facilityId: string; programId: string; userId?: string };
const origin = randomId();
const channelName = () => `${getLocalDb().name}:stock-event-accepted`;

export function invalidateAcceptedStockEvent(queryClient: QueryClient) {
  for (const queryKey of [
    queryKeys.stockEvents.all,
    queryKeys.stockCards.all,
    queryKeys.stockCardSummaries.all,
    queryKeys.lots.all,
  ])
    void queryClient.invalidateQueries({ queryKey });
}

export function refreshAfterStockEventAccepted(
  queryClient: QueryClient,
  event: AcceptedScope,
  refreshOfflineDownload?: (refreshKey: string) => void,
) {
  const userId = getSessionUserId();
  if (!userId || (event.userId && event.userId !== userId)) return;
  refreshOfflineDownload?.(`${event.facilityId}:${event.programId}`);
  invalidateAcceptedStockEvent(queryClient);
  if (typeof BroadcastChannel === 'undefined') return;
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(channelName());
    channel.postMessage({
      type: 'accepted',
      origin,
      userId,
    });
  } catch {
    return;
  } finally {
    channel?.close();
  }
}

export function subscribeStockEventAcceptances(queryClient: QueryClient) {
  let channel: BroadcastChannel | undefined;
  const watch = () => {
    channel?.close();
    channel = undefined;
    const userId = getSessionUserId();
    if (!userId || typeof BroadcastChannel === 'undefined') return;
    const scope = getSessionScope();
    try {
      channel = new BroadcastChannel(channelName());
    } catch {
      return;
    }
    channel.onmessage = ({ data }) => {
      if (
        scope !== getSessionScope() ||
        data?.type !== 'accepted' ||
        data.origin === origin ||
        data.userId !== userId
      )
        return;
      invalidateAcceptedStockEvent(queryClient);
    };
  };
  const unsubscribe = subscribeSessionScope(watch);
  watch();
  return () => {
    unsubscribe();
    channel?.close();
  };
}
