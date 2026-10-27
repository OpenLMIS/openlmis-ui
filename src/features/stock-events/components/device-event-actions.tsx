import { EyeIcon, RotateCwIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type CardAction, RowActions, useInCards } from '@/components/card-actions';
import {
  canRemoveDeviceEvent,
  DeviceEventRemoval,
  removeKey,
} from '@/features/stock-events/components/device-event-removal';
import { useRefusedEventRetry } from '@/features/stock-events/hooks/use-refused-event-retry';
import { type DeviceEvent, sameDeviceAttempt } from '@/features/stock-events/lib/stock-event-sync';

export function DeviceEventActions({
  event,
  canSend,
  label,
  removeLabel,
  onOpen,
  onRemoved,
}: {
  event: DeviceEvent;
  canSend: boolean;
  label: string;
  removeLabel: string;
  onOpen: () => void;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const inCards = useInCards();
  const [removing, setRemoving] = useState<DeviceEvent | null>(null);
  if (removing && !sameDeviceAttempt(removing, event)) setRemoving(null);
  const retry = useRefusedEventRetry(event, canSend, onRemoved);
  const actions: CardAction[] = [
    ...(retry.available
      ? [
          {
            id: 'retry',
            icon: <RotateCwIcon />,
            label: t('offline-events.retry-refused'),
            disabled: retry.pending || !canSend,
            onSelect: () => {
              void retry.retry();
            },
          },
        ]
      : []),
    {
      id: 'review',
      icon: <EyeIcon />,
      label: t('offline-events.review-event'),
      name: inCards ? label : undefined,
      onSelect: onOpen,
      disabled: retry.pending,
    },
    ...(canRemoveDeviceEvent(event)
      ? [
          {
            id: 'remove',
            icon: <Trash2Icon />,
            label: t(removeKey(event)),
            name: inCards ? removeLabel : undefined,
            destructive: true,
            disabled: retry.pending,
            onSelect: () => setRemoving(event),
          },
        ]
      : []),
  ];
  return (
    <>
      <RowActions actions={actions} label={t('offline-events.actions-label', { event: label })} />
      {removing && (
        <DeviceEventRemoval
          event={removing}
          onClose={() => setRemoving(null)}
          onRemoved={onRemoved}
        />
      )}
    </>
  );
}
