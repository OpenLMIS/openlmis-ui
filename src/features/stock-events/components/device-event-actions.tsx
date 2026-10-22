import { EyeIcon, RotateCwIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type CardAction, CardActions, RowActions, useInCards } from '@/components/card-actions';
import {
  canRemoveDeviceEvent,
  DeviceEventRemoval,
} from '@/features/stock-events/components/device-event-removal';
import { useRefusedEventRetry } from '@/features/stock-events/hooks/use-refused-event-retry';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

export function DeviceEventActions({
  event,
  canSend,
  label,
  removeLabel,
  onOpen,
  onRemoved,
  layout = 'menu',
}: {
  layout?: 'menu' | 'cards';
  event: DeviceEvent;
  canSend: boolean;
  label: string;
  removeLabel: string;
  onOpen: () => void;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const inCards = useInCards() || layout === 'cards';
  const [removing, setRemoving] = useState(false);
  const retry = useRefusedEventRetry(event, canSend);
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
            label: t(
              event.status === 'refused' ? 'offline-events.dismiss' : 'offline-events.remove',
            ),
            name: inCards ? removeLabel : undefined,
            destructive: true,
            disabled: retry.pending,
            onSelect: () => setRemoving(true),
          },
        ]
      : []),
  ];
  const Actions = layout === 'cards' ? CardActions : RowActions;
  return (
    <>
      <Actions actions={actions} label={t('offline-events.actions-label', { event: label })} />
      {removing && (
        <DeviceEventRemoval
          event={event}
          onClose={() => setRemoving(false)}
          onRemoved={onRemoved}
        />
      )}
    </>
  );
}
