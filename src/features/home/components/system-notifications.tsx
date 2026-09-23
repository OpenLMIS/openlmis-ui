import { useSuspenseQuery } from '@tanstack/react-query';
import { InfoIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { systemNotificationsOptions } from '@/features/home/api/queries';

/** Notices an administrator published for everyone; nothing at all when there are none. */
export function SystemNotifications() {
  const { data: notifications } = useSuspenseQuery(systemNotificationsOptions());
  if (notifications.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {notifications.map((notification) => (
        <Alert key={notification.id}>
          <InfoIcon />
          {notification.title && <AlertTitle>{notification.title}</AlertTitle>}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
