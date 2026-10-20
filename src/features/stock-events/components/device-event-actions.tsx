import { EyeIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
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
  return (
    <>
      {layout === 'cards' ? (
        <div className="flex shrink-0 items-center gap-1">
          <div className="size-7">
            {canRemoveDeviceEvent(event) && (
              <Button
                variant="destructive"
                size="icon-sm"
                aria-label={removeLabel}
                onClick={() => setRemoving(true)}
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
          <Button variant="outline" size="icon-sm" aria-label={label} onClick={onOpen}>
            <EyeIcon />
          </Button>
        </div>
      ) : (
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
          <DropdownMenuContent width="content">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onOpen}>
                <EyeIcon />
                {t('device-events.review-event')}
              </DropdownMenuItem>
              {canRemoveDeviceEvent(event) && (
                <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}>
                  <Trash2Icon />
                  {t('device-events.remove')}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
