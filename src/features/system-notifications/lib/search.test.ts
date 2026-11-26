import { expect, it } from 'vitest';
import {
  notificationsSearchSchema,
  toNotificationsQuery,
} from '@/features/system-notifications/lib/search';

it('maps URL filters and one-based paging to the notification API', () => {
  const authorId = '64218385-610e-455a-85af-7cfc88808355';
  const search = notificationsSearchSchema.parse({
    authorId,
    displayed: true,
    page: 3,
    size: 25,
    notification: 'new',
  });
  expect(toNotificationsQuery(search)).toEqual({
    authorId,
    isDisplayed: true,
    expand: 'author',
    page: 2,
    size: 25,
  });
  expect(toNotificationsQuery(notificationsSearchSchema.parse({ displayed: false }))).toEqual({
    expand: 'author',
    page: 0,
    size: 10,
  });
});
