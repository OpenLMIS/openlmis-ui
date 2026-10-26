import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { announceDeviceSave } from '@/features/stock-events/lib/device-save-announcement';
import { createStockEventContext } from '@/features/stock-events/lib/stock-event-local';
import { type DeviceEvent, retryRefusedEvent } from '@/features/stock-events/lib/stock-event-sync';
import { useSessionMutation } from '@/hooks/use-session-mutation';

export function useRefusedEventRetry(
  event: DeviceEvent,
  canSend: boolean,
  onDone?: () => void,
  onStale?: () => void,
) {
  const { t } = useTranslation();
  const available =
    event.status === 'refused' &&
    !!event.error &&
    !event.error.resolvedAt &&
    !event.error.dismissedAt;
  const operation = useSessionMutation({
    mutationFn: async () => {
      if (!available || !canSend || !event.error) return false;
      return retryRefusedEvent(createStockEventContext(event), event.error);
    },
    retry: false,
  });
  const retry = async () => {
    try {
      const changed = await operation.mutateAsync();
      if (!operation.isCurrent()) return;
      if (changed) {
        announceDeviceSave('offline-events.status-queued');
        onDone?.();
      } else {
        toast.warning(t('offline-events.changed-title'), {
          description: t('offline-events.changed-description'),
        });
        onStale?.();
      }
    } catch {
      if (!operation.isCurrent()) return;
      toast.error(t('offline-events.action-failed'), {
        description: t('offline-events.action-failed-description'),
      });
    }
  };
  return { available, pending: operation.isPending, retry };
}
