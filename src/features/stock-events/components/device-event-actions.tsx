import { MoreHorizontalIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  canRemoveDeviceEvent,
  DeviceEventRemoval,
} from '@/features/stock-events/components/device-event-removal';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

export function DeviceEventActions({
  event,
  label,
  onOpen,
  onRemoved,
}: {
  event: DeviceEvent;
  label: string;
  onOpen: () => void;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const [removing, setRemoving] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('device-events.actions-label', { event: label })}
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onOpen}>{t('device-events.review-event')}</DropdownMenuItem>
            {canRemoveDeviceEvent(event) && (
              <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}>
                {t('device-events.remove')}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
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
