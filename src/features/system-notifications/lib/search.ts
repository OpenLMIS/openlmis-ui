import { z } from 'zod';
import type { NotificationsQuery } from '@/features/system-notifications/lib/types';
import { tableSearchSchema, toPaginationState } from '@/lib/table-search';

const idSchema = z.guid().optional().catch(undefined);

export const notificationsSearchSchema = tableSearchSchema(['title'])
  .omit({ sort: true, dir: true })
  .extend({
    authorId: idSchema,
    displayed: z.literal(true).optional().catch(undefined),
    notification: z
      .union([z.literal('new'), z.guid()])
      .optional()
      .catch(undefined),
  });

export type NotificationsSearch = z.infer<typeof notificationsSearchSchema>;

export const CLEARED_NOTIFICATION_FILTERS = {
  authorId: undefined,
  displayed: undefined,
  page: undefined,
} satisfies Partial<NotificationsSearch>;

export function toNotificationsQuery(search: NotificationsSearch): NotificationsQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    expand: 'author',
    ...(search.authorId && { authorId: search.authorId }),
    ...(search.displayed && { isDisplayed: true }),
  };
}

export const SYSTEM_NOTIFICATION_HIDEABLE_COLUMNS = [
  { id: 'author', labelKey: 'system-notifications.admin.author' },
  { id: 'createdDate', labelKey: 'system-notifications.admin.created-date' },
  { id: 'active', labelKey: 'system-notifications.admin.active' },
  { id: 'displayed', labelKey: 'system-notifications.admin.is-displayed' },
  { id: 'message', labelKey: 'system-notifications.admin.message' },
] as const;
