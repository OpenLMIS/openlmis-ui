import { queryOptions } from '@tanstack/react-query';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import {
  fetchNotification,
  fetchNotificationAuthor,
  fetchNotificationsPage,
  fetchSystemNotifications,
} from '@/features/system-notifications/api/api';
import type {
  NotificationsQuery,
  SystemNotification,
} from '@/features/system-notifications/lib/types';
import { verifiedStoredTimeZone } from '@/lib/deployment-time-zone';
import { queryKeys } from '@/lib/key-factory';
import { fullName } from '@/lib/text';
import type { Page } from '@/lib/types';

export const notificationListsKey = [...queryKeys.systemNotifications.all, 'list'] as const;

export const SYSTEM_NOTIFICATIONS_STALE_TIME = 30_000;

export const systemNotificationsOptions = () =>
  queryOptions({
    queryKey: queryKeys.systemNotifications.list({ displayed: true }),
    queryFn: ({ signal }) => fetchSystemNotifications({ signal }),
    networkMode: 'online',
    refetchOnWindowFocus: true,
    staleTime: SYSTEM_NOTIFICATIONS_STALE_TIME,
  });

export const notificationsPageOptions = ({ expand, isDisplayed, ...params }: NotificationsQuery) =>
  queryOptions({
    queryKey: queryKeys.systemNotifications.list({ admin: { ...params, displayed: isDisplayed } }),
    queryFn: ({ signal }) => fetchNotificationsPage({ ...params, expand, isDisplayed }, signal),
    refetchOnWindowFocus: 'always',
  });

export const notificationAuthorOptions = (authorId: string) =>
  queryOptions({
    queryKey: [...queryKeys.systemNotifications.all, 'author', authorId],
    queryFn: async ({ client, signal }) => {
      const lists = client.getQueriesData<Page<SystemNotification>>({
        queryKey: notificationListsKey,
        predicate: ({ queryKey }) =>
          Boolean((queryKey[2] as { admin?: unknown } | undefined)?.admin),
      });
      for (const [, page] of lists) {
        const author = page?.content.find(
          (notice) => notice.author?.id === authorId && fullName(notice.author),
        )?.author;
        if (author) return fullName(author);
      }
      const author = await fetchNotificationAuthor(authorId, signal);
      return author ? fullName(author) : '';
    },
  });

export const notificationDetailOptions = (id: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.systemNotifications.detail(id), opening] as const,
    queryFn: ({ signal }) => fetchNotification(id, signal),
    staleTime: Infinity,
  });

export class DeploymentTimeZoneUnavailable extends Error {}

export const notificationTimeZoneOptions = (opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.localeSettings.detail('notification-form'), opening],
    queryFn: async ({ client }) => {
      const { zone, read } = await client.fetchQuery(deploymentTimeZoneOptions());
      const verified = read ? zone : verifiedStoredTimeZone();
      if (!verified) throw new DeploymentTimeZoneUnavailable();
      return verified;
    },
    retry: false,
    staleTime: Infinity,
  });
