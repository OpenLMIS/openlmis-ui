import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { createStockEventContext } from '@/features/stock-events/lib/stock-event-local';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import {
  type DeviceEvent,
  dismissRefusedEvent,
  hideAcceptedEvent,
  removeQueuedEvent,
} from '@/features/stock-events/lib/stock-event-sync';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { announceDeviceSave } from '@/lib/device-save-announcement';

export const canRemoveDeviceEvent = (event: DeviceEvent) =>
  event.status === 'accepted' ||
  event.status === 'refused' ||
  (event.status === 'queued' && !event.attemptId);

export function DeviceEventRemoval({
  event,
  onClose,
  onRemoved,
}: {
  event: DeviceEvent;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const mutation = useSessionMutation({
    mutationFn: async () => {
      const context = createStockEventContext(event);
      if (event.status === 'accepted') return hideAcceptedEvent(context, event);
      if (event.status === 'refused')
        return event.error ? dismissRefusedEvent(context, event.error) : false;
      return event.status === 'queued'
        ? removeQueuedEvent(context, event as QueuedStockEvent)
        : false;
    },
    retry: false,
  });
  const remove = async () => {
    try {
      const changed = await mutation.mutateAsync();
      if (!mutation.isCurrent()) return;
      if (changed) {
        announceDeviceSave(
          event.status === 'accepted'
            ? 'device-events.synced-removed'
            : event.status === 'refused'
              ? 'device-events.refused-removed'
              : 'device-events.removed',
        );
        onRemoved();
      } else
        toast.warning(t('device-events.changed-title'), {
          description: t('device-events.changed-description'),
        });
      onClose();
    } catch {
      if (mutation.isCurrent())
        toast.error(t('device-events.action-failed'), {
          description: t('device-events.action-failed-description'),
        });
    }
  };
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('device-events.remove')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              event.status === 'accepted'
                ? 'device-events.remove-synced-warning'
                : event.status === 'refused'
                  ? 'device-events.remove-refused-warning'
                  : 'device-events.remove-warning',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            {t('device-events.cancel')}
          </AlertDialogCancel>
          <Button variant="destructive" disabled={mutation.isPending} onClick={() => void remove()}>
            {t('device-events.remove')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
