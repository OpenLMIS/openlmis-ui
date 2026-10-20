import { EyeIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type CardAction, CardActions, RowActions } from '@/components/card-actions';
import {
  canRemoveDeviceEvent,
  DeviceEventRemoval,
} from '@/features/stock-events/components/device-event-removal';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

export function DeviceEventActions({
  event,
  label,
  removeLabel,
  onOpen,
  onRemoved,
  layout = 'menu',
}: {
  layout?: 'menu' | 'cards';
  event: DeviceEvent;
  label: string;
  removeLabel: string;
  onOpen: () => void;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const [removing, setRemoving] = useState(false);
  const actions: CardAction[] = [
    {
      id: 'review',
      icon: <EyeIcon />,
      label: t('device-events.review-event'),
      name: layout === 'cards' ? label : undefined,
      onSelect: onOpen,
    },
    ...(canRemoveDeviceEvent(event)
      ? [
          {
            id: 'remove',
            icon: <Trash2Icon />,
            label: t('device-events.remove'),
            name: layout === 'cards' ? removeLabel : undefined,
            destructive: true,
            onSelect: () => setRemoving(true),
          },
        ]
      : []),
  ];
  const Actions = layout === 'cards' ? CardActions : RowActions;
  return (
    <>
      <Actions actions={actions} label={t('device-events.actions-label', { event: label })} />
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
