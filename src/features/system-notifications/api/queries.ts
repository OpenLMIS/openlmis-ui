import { queryOptions } from '@tanstack/react-query';
import {
  fetchNotification,
  fetchNotificationAuthor,
  fetchNotificationsPage,
  fetchSystemNotifications,
} from '@/features/system-notifications/api/api';
import type { NotificationsQuery } from '@/features/system-notifications/lib/types';
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
  });
