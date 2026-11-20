import type { AxiosRequestConfig } from 'axios';
import type { SystemNotification } from '@/features/system-notifications/lib/types';
import { client } from '@/integrations/axios';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

export async function fetchSystemNotifications(
  config?: AxiosRequestConfig,
): Promise<SystemNotification[]> {
  const scope = getSessionScope();
  const notifications: SystemNotification[] = [];
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
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
