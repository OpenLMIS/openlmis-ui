import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { BellIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { QueryBoundary } from '@/components/query-boundary';
import { Block } from '@/components/skeleton-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { systemNotificationsOptions } from '@/features/home/api/queries';
import { useFormatNumber } from '@/features/home/components/dashboard-parts';
import { sanitizeNotification } from '@/features/home/lib/sanitize-notification';
import type { SystemNotification } from '@/features/home/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { useOnline } from '@/lib/online';

const HideNotifications = () => null;

export function SystemNotifications({ revision }: { revision: number }) {
  const online = useOnline();
  const queryClient = useQueryClient();
  if (!online && !queryClient.getQueryData(systemNotificationsOptions().queryKey)) return null;

  return (
    <QueryBoundary
      errorComponent={HideNotifications}
      pendingFallback={<NotificationsPending />}
      resetKey={`notifications:${revision}:${online}`}
    >
      <NotificationsButton />
    </QueryBoundary>
  );
}

function NotificationsPending() {
  const { t } = useTranslation();
  return (
    <Button disabled size="lg" type="button" variant="outline">
      <BellIcon data-icon="inline-start" />
      {t('home.notifications.title')}
      <Block className="h-5 w-6" shape="circle" />
    </Button>
  );
}

function NotificationsButton() {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const { data: notifications } = useSuspenseQuery(systemNotificationsOptions());
  if (notifications.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger render={<Button size="lg" type="button" variant="outline" />}>
        <BellIcon data-icon="inline-start" />
        {t('home.notifications.title')}
        <Badge variant="secondary">{formatNumber(notifications.length)}</Badge>
      </PopoverTrigger>
      <PopoverContent align="end" width="notifications">
        <PopoverHeader>
          <PopoverTitle>{t('home.notifications.title')}</PopoverTitle>
        </PopoverHeader>
        <ul className="flex min-w-0 flex-col gap-4">
          {notifications.map((notification) => (
            <Notification key={notification.id} notification={notification} />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function Notification({ notification }: { notification: SystemNotification }) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const message = useMemo(() => sanitizeNotification(notification.message), [notification.message]);
  const author = [notification.author?.firstName, notification.author?.lastName]
    .filter(Boolean)
    .join(' ');
  const created = formatTimestamp(notification.createdDate, i18n.language, {
    time: true,
    timeZone,
  });

  return (
    <li className="flex min-w-0 flex-col gap-2 wrap-anywhere">
      {notification.title && <h3 className="font-medium">{notification.title}</h3>}
      {(author || created) && (
        <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
          {author && (
            <div className="flex flex-wrap gap-x-2">
              <dt>{t('home.notifications.author')}</dt>
              <dd>{author}</dd>
            </div>
          )}
          {created && (
            <div className="flex flex-wrap gap-x-2">
              <dt>{t('home.notifications.created')}</dt>
              <dd>
                <time dateTime={notification.createdDate ?? undefined}>{created}</time>
              </dd>
            </div>
          )}
        </dl>
      )}
      <div
        className="whitespace-pre-wrap [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizeNotification restricts tags, attributes and URLs.
        dangerouslySetInnerHTML={{ __html: message }}
      />
    </li>
  );
}
