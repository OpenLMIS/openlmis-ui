import { useQuery } from '@tanstack/react-query';
import { BellIcon, MegaphoneIcon } from 'lucide-react';
import { type Ref, useId, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { LocalizedCount } from '@/components/i18n/localized-count';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { systemNotificationsOptions } from '@/features/system-notifications/api/queries';
import { sanitizeNotification } from '@/features/system-notifications/lib/sanitize-notification';
import type { SystemNotification } from '@/features/system-notifications/lib/types';
import { isOnline, useOnline } from '@/lib/online';
import { isSessionAuthenticated } from '@/lib/session-scope';

export function SystemNotifications() {
  const online = useOnline();
  const authenticated = isSessionAuthenticated();
  const { t } = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { data, isError, isFetching, refetch } = useQuery({
    ...systemNotificationsOptions(),
    enabled: authenticated && online,
  });
  if (!authenticated || (!online && data === undefined)) return null;

  const count = data?.length;
  const title = t('nav.administration.system-notifications');
  const label =
    count === undefined
      ? title
      : count === 0
        ? t('system-notifications.empty')
        : t('system-notifications.count', { count });

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label={label}
              render={<Button padding="none" size="lg" type="button" variant="ghost" />}
            >
              <span className="relative grid h-8 w-11 place-items-center">
                <BellIcon aria-hidden />
                {count !== undefined && count > 0 && (
                  <span
                    aria-hidden
                    className="absolute end-0 top-0 min-w-4 rounded-full bg-primary px-1 text-center text-2xs leading-4 text-primary-foreground tabular-nums"
                  >
                    <LocalizedCount count={count} />
                  </span>
                )}
              </span>
            </PopoverTrigger>
          }
        />
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        initialFocus={() => listRef.current ?? popupRef.current}
        padding="none"
        ref={popupRef}
        width="notifications"
      >
        <div className="px-4 py-3">
          <PopoverTitle id={titleId}>{title}</PopoverTitle>
        </div>
        <Separator />
        {data?.length ? (
          <NotificationList labelledBy={titleId} notifications={data} ref={listRef} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-muted-foreground">
            {data ? (
              <p>{t('system-notifications.empty')}</p>
            ) : isError && !isFetching ? (
              <>
                <p>{t('system-notifications.error')}</p>
                <Button
                  onClick={() => {
                    popupRef.current?.focus();
                    if (isOnline() && isSessionAuthenticated()) void refetch();
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t('error.try-again')}
                </Button>
              </>
            ) : (
              <p>{t('system-notifications.loading')}</p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationList({
  labelledBy,
  notifications,
  ref,
}: {
  labelledBy: string;
  notifications: SystemNotification[];
  ref: Ref<HTMLDivElement>;
}) {
  const online = useOnline();
  const { data } = useQuery({ ...deploymentTimeZoneOptions(), enabled: online });
  const timeZone = data?.zone ?? 'UTC';

  return (
    <ScrollArea
      height="fill"
      viewportProps={{
        'aria-labelledby': labelledBy,
        ref,
        role: 'region',
        style: { overscrollBehavior: 'contain' },
      }}
    >
      <ul className="divide-y">
        {notifications.map((notification) => (
          <Notification key={notification.id} notification={notification} timeZone={timeZone} />
        ))}
      </ul>
    </ScrollArea>
  );
}

function Notification({
  notification,
  timeZone,
}: {
  notification: SystemNotification;
  timeZone: string;
}) {
  const { i18n } = useTranslation();
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
        {(notification.title || created) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {notification.title && (
              <h3 className="min-w-0 text-sm font-medium" dir="auto">
                {notification.title}
              </h3>
            )}
            {created && (
              <Badge
                render={<time dateTime={notification.createdDate ?? undefined} />}
                variant="secondary"
              >
                {created}
              </Badge>
            )}
          </div>
        )}
        <div
          className="text-sm/relaxed whitespace-pre-wrap text-muted-foreground [&_a]:rounded-xs [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/40 [&_a]:underline-offset-4 [&_a]:outline-none [&_a]:hover:decoration-primary [&_a]:focus-visible:ring-3 [&_a]:focus-visible:ring-ring/50 [&_ol]:list-decimal [&_ol]:ps-5 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:ps-5"
          dir="auto"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizeNotification restricts tags, attributes and URLs.
          dangerouslySetInnerHTML={{ __html: message }}
        />
        {author && <p className="text-xs text-muted-foreground">{author}</p>}
      </div>
    </li>
  );
}
