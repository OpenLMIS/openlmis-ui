import { z } from 'zod';
import type { UsersQuery } from '@/features/users/lib/types';
import {
  type DefaultSort,
  tableSearchSchema,
  textFilterSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

/** View menu columns in display order; username is left out, so it always shows. `hideBelow` drops a column when the page has no room. */
export const USER_HIDEABLE_COLUMNS = [
  { id: 'lastName', labelKey: 'users.name', hideBelow: 'xl' },
  { id: 'email', labelKey: 'users.email', hideBelow: '4xl' },
  { id: 'active', labelKey: 'users.status', hideBelow: 'md' },
] as const;

const USER_SORT_FIELDS = ['username', 'firstName', 'lastName', 'active'] as const;

export const DEFAULT_USERS_SORT: DefaultSort = { id: 'username', desc: false };

export const usersSearchSchema = tableSearchSchema(USER_SORT_FIELDS).extend({
  q: textFilterSchema,
  status: z.enum(['active', 'inactive']).optional().catch(undefined),
  /** The open dialog: `new` to add a user, or the id of the one being edited. */
  user: z
    .union([z.literal('new'), z.guid()])
    .optional()
    .catch(undefined),
  /** The user whose password is being set or reset. */
  password: z.guid().optional().catch(undefined),
  /** Set with `password` right after an add, when the user has no password yet. */
  created: z.boolean().optional().catch(undefined),
});

export type UsersSearch = z.infer<typeof usersSearchSchema>;

/** Every filter off and back to the first page. */
export const CLEARED_USER_FILTERS = {
  q: undefined,
  status: undefined,
  page: undefined,
} satisfies Partial<UsersSearch>;

export function hasUserFilters(search: UsersSearch) {
  return Boolean(search.q || search.status);
}

export function toUsersQuery(search: UsersSearch): UsersQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    page: pageIndex,
    size: pageSize,
    sort: toSortParam(search, DEFAULT_USERS_SORT),
    q: search.q?.trim(),
    active: search.status === undefined ? undefined : search.status === 'active',
  };
}
