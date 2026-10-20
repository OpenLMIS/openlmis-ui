import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { BellIcon, MegaphoneIcon } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { QueryBoundary } from '@/components/query-boundary';
import { Block } from '@/components/skeleton-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
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
  const popupRef = useRef<HTMLDivElement>(null);
  const { data: notifications } = useSuspenseQuery(systemNotificationsOptions());
  if (notifications.length === 0) return null;
  const count = formatNumber(notifications.length);

  return (
    <Popover>
      <PopoverTrigger render={<Button size="lg" type="button" variant="outline" />}>
        <BellIcon data-icon="inline-start" />
        {t('home.notifications.title')}
        <Badge variant="secondary">{count}</Badge>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        initialFocus={popupRef}
        padding="none"
        ref={popupRef}
        width="notifications"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <PopoverTitle>{t('home.notifications.title')}</PopoverTitle>
          <Badge aria-hidden variant="secondary">
            {count}
          </Badge>
        </div>
        <Separator />
        <ul className="min-h-0 divide-y overflow-y-auto overscroll-contain">
          {notifications.map((notification) => (
            <Notification key={notification.id} notification={notification} />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function Notification({ notification }: { notification: SystemNotification }) {
  const { i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const message = useMemo(() => sanitizeNotification(notification.message), [notification.message]);
  const author = [notification.author?.firstName, notification.author?.lastName]
    .filter(Boolean)
    .join(' ');
  const created = formatTimestamp(notification.createdDate, i18n.language, {
    time: 'short',
    timeZone,
  });

  return (
    <li className="flex min-w-0 gap-3 px-4 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
        <MegaphoneIcon aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 wrap-anywhere">
        {notification.title && (
          <h3 className="text-sm font-medium" dir="auto">
            {notification.title}
          </h3>
        )}
        <div
          className="text-sm/relaxed whitespace-pre-wrap text-muted-foreground [&_a]:rounded-xs [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/40 [&_a]:underline-offset-4 [&_a]:outline-none [&_a]:hover:decoration-primary [&_a]:focus-visible:ring-3 [&_a]:focus-visible:ring-ring/50 [&_ol]:list-decimal [&_ol]:ps-5 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:ps-5"
          dir="auto"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizeNotification restricts tags, attributes and URLs.
          dangerouslySetInnerHTML={{ __html: message }}
        />
        {(author || created) && (
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {author && <span>{author}</span>}
            {author && created && <span aria-hidden>·</span>}
            {created && <time dateTime={notification.createdDate ?? undefined}>{created}</time>}
          </p>
        )}
      </div>
    </li>
  );
}
