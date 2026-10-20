import type { QueryClient } from '@tanstack/react-query';
import { getLocalDb } from '@/integrations/local-db';
import { queryKeys } from '@/lib/key-factory';
import { refreshOfflineProgram } from '@/lib/offline-download-status';
import { getSessionScope } from '@/lib/session-scope';
import { getSessionState, subscribeSessionState } from '@/lib/session-state';

type AcceptedScope = { facilityId: string; programId: string; userId?: string };
const origin = crypto.randomUUID();
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

export function refreshAfterStockEventAccepted(queryClient: QueryClient, event: AcceptedScope) {
  const userId = getSessionState().referenceDataUserId;
  if (!userId || (event.userId && event.userId !== userId)) return;
  refreshOfflineProgram(event);
  invalidateAcceptedStockEvent(queryClient);
  if (typeof BroadcastChannel === 'undefined') return;
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(channelName());
    channel.postMessage({
      type: 'accepted',
      origin,
      userId,
      facilityId: event.facilityId,
      programId: event.programId,
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
    const userId = getSessionState().referenceDataUserId;
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
        data.userId !== userId ||
        typeof data.facilityId !== 'string' ||
        typeof data.programId !== 'string'
      )
        return;
      invalidateAcceptedStockEvent(queryClient);
    };
  };
  const unsubscribe = subscribeSessionState((state, previous) => {
    if (state.referenceDataUserId !== previous.referenceDataUserId) watch();
  });
  watch();
  return () => {
    unsubscribe();
    channel?.close();
  };
}
