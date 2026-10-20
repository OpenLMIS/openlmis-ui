import type { TFunction } from 'i18next';
import type { StockEventSyncError } from '@/features/stock-events/lib/stock-event-sync';

export function refusalMessage(
  error: Pick<StockEventSyncError, 'message' | 'messageKey'> | undefined,
  t: TFunction,
) {
  return error?.message.trim() && error.message !== error.messageKey
    ? error.message
    : t('offline-events.refused-description');
}
