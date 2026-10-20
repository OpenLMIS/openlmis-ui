import {
  AlertTriangleIcon,
  CheckIcon,
  CircleXIcon,
  ClockIcon,
  LoaderCircleIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

export function EventStatus({ event }: { event: DeviceEvent }) {
  const { t } = useTranslation();
  const Icon =
    event.status === 'uncertain'
      ? AlertTriangleIcon
      : event.status === 'refused'
        ? CircleXIcon
        : event.status === 'accepted'
          ? CheckIcon
          : event.status === 'sending'
            ? LoaderCircleIcon
            : ClockIcon;
  return (
    <Badge
      variant={
        event.status === 'uncertain'
          ? 'warning'
          : event.status === 'refused'
            ? 'destructive'
            : event.status === 'accepted'
              ? 'success'
              : 'info'
      }
    >
      <Icon
        aria-hidden="true"
        data-icon="inline-start"
        className={
          event.status === 'sending' ? 'animate-spin motion-reduce:animate-none' : undefined
        }
      />
      {t(
        event.receipt?.source === 'user'
          ? 'offline-events.recorded-by-you'
          : `offline-events.status-${event.status}`,
      )}
    </Badge>
  );
}
