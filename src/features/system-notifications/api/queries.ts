import { queryOptions } from '@tanstack/react-query';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import {
  fetchNotification,
  fetchNotificationAuthor,
  fetchNotificationsPage,
  fetchSystemNotifications,
} from '@/features/system-notifications/api/api';
import type { NotificationsQuery } from '@/features/system-notifications/lib/types';
import { verifiedStoredTimeZone } from '@/lib/deployment-time-zone';
import { queryKeys } from '@/lib/key-factory';

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
    queryKey: queryKeys.systemNotifications.list({ authors: true, authorId }),
    queryFn: ({ signal }) => fetchNotificationAuthor(authorId, signal),
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
