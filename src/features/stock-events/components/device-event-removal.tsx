import { useState } from 'react';
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
import { announceDeviceSave } from '@/features/stock-events/lib/device-save-announcement';
import { createStockEventContext } from '@/features/stock-events/lib/stock-event-local';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import {
  type DeviceEvent,
  dismissRefusedEvent,
  hideAcceptedEvent,
  removeQueuedEvent,
} from '@/features/stock-events/lib/stock-event-sync';
import { useSessionMutation } from '@/hooks/use-session-mutation';

export const canRemoveDeviceEvent = (event: DeviceEvent) =>
  event.status === 'accepted' ||
  event.status === 'refused' ||
  (event.status === 'queued' && !event.attemptId);

export const removeKey = (event: DeviceEvent) =>
  event.status === 'refused' ? 'offline-events.dismiss' : 'offline-events.remove';

export function DeviceEventRemoval({
  event: initialEvent,
  onClose,
  onRemoved,
}: {
  event: DeviceEvent;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const [event] = useState(initialEvent);
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
            ? 'offline-events.synced-removed'
            : event.status === 'refused'
              ? 'offline-events.refused-dismissed'
              : 'offline-events.removed',
        );
        onRemoved();
      } else
        toast.warning(t('offline-events.changed-title'), {
          description: t('offline-events.changed-description'),
        });
      onClose();
    } catch {
      if (mutation.isCurrent())
        toast.error(t('offline-events.action-failed'), {
          description: t('offline-events.action-failed-description'),
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
          <AlertDialogTitle>{t(removeKey(event))}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              event.status === 'accepted'
                ? 'offline-events.remove-synced-warning'
                : event.status === 'refused'
                  ? 'offline-events.dismiss-warning'
                  : 'offline-events.remove-warning',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            {t('offline-events.cancel')}
          </AlertDialogCancel>
          <Button variant="destructive" disabled={mutation.isPending} onClick={() => void remove()}>
            {t(removeKey(event))}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
