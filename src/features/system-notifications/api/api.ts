import type { AxiosRequestConfig } from 'axios';
import type {
  NotificationPayload,
  NotificationsQuery,
  NotificationUpdate,
  SavedNotification,
  SystemNotification,
} from '@/features/system-notifications/lib/types';
import { client } from '@/integrations/axios';
import { requireOnline } from '@/lib/local-data';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

export async function fetchSystemNotifications(
  config?: AxiosRequestConfig,
): Promise<SystemNotification[]> {
  const scope = getSessionScope();
  const notifications: SystemNotification[] = [];
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    requireOnline();
    const { data } = await client.get<Page<SystemNotification>>('/systemNotifications', {
      ...config,
      connectionStatus: false,
      params: { isDisplayed: true, expand: 'author', page, size: 100, sort: 'createdDate,desc' },
    });
    assertSessionScope(scope);
    notifications.push(...data.content);
    if (page + 1 >= data.totalPages) break;
  }
  return notifications;
}

export async function fetchNotificationsPage(params: NotificationsQuery, signal?: AbortSignal) {
  const { data } = await client.get<Page<SystemNotification>>('/systemNotifications', {
    params,
    signal,
  });
  return data;
}

export async function fetchNotificationAuthor(authorId: string, signal?: AbortSignal) {
  const page = await fetchNotificationsPage(
    { authorId, expand: 'author', page: 0, size: 1 },
    signal,
  );
  return page.content[0]?.author ?? null;
}

export async function fetchNotification(id: string, signal?: AbortSignal) {
  const { data } = await client.get<SavedNotification>(`/systemNotifications/${id}`, { signal });
  return data;
}

export async function createNotification(payload: NotificationPayload) {
  const { data } = await client.post<SavedNotification>('/systemNotifications', payload);
  return data;
}

export async function updateNotification(payload: NotificationUpdate) {
  const { data } = await client.put<SavedNotification>(
    `/systemNotifications/${payload.id}`,
    payload,
  );
  return data;
}
