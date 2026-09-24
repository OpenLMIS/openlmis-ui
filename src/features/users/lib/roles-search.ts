import { z } from 'zod';
import { ROLE_SORT_FIELDS, ROLE_TABS } from '@/features/users/lib/role-assignments';
import { type DefaultSort, tableSearchSchema, textFilterSchema } from '@/lib/table-search';

const tabIds = ROLE_TABS.map((tab) => tab.id) as [
  (typeof ROLE_TABS)[number]['id'],
  ...(typeof ROLE_TABS)[number]['id'][],
];

export const DEFAULT_ROLES_SORT: DefaultSort = { id: 'role', desc: false };

export const rolesSearchSchema = tableSearchSchema(ROLE_SORT_FIELDS).extend({
  /** Left out for the first tab, Supervision. */
  tab: z.enum(tabIds).optional().catch(undefined),
  q: textFilterSchema,
  /** The open dialog: adding a role on the current tab, or importing another user's roles. */
  dialog: z.enum(['add', 'import']).optional().catch(undefined),
  /** The role whose rights are shown. */
  rights: z.string().min(1).optional().catch(undefined),
});

export type RolesSearch = z.infer<typeof rolesSearchSchema>;

/** A different tab lists different rows, so its filter, paging and sort start over. */
export const TAB_RESET = {
  q: undefined,
  page: undefined,
  sort: undefined,
  dir: undefined,
} satisfies Partial<RolesSearch>;

export const CLOSED_ROLE_DIALOGS = {
  dialog: undefined,
  rights: undefined,
} satisfies Partial<RolesSearch>;
