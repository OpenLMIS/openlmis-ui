import type { ParseKeys, TFunction } from 'i18next';
import type { StockEventSyncError } from '@/features/stock-events/lib/stock-event-sync';

export function refusalMessage(
  error: Pick<StockEventSyncError, 'message' | 'messageKey'> | undefined,
  t: TFunction,
  fallback: ParseKeys = 'offline-events.refused-description',
) {
  return error?.message.trim() && error.message !== error.messageKey ? error.message : t(fallback);
}
