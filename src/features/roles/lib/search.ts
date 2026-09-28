import { z } from 'zod';
import { ROLE_TYPES } from '@/features/reference-data/lib/roles';
import { type DefaultSort, tableSearchSchema, textFilterSchema } from '@/lib/table-search';

/** View menu columns in display order; the role's name is left out, so it always shows. */
export const ROLE_HIDEABLE_COLUMNS = [
  { id: 'type', labelKey: 'roles.type', hideBelow: 'md' },
  { id: 'description', labelKey: 'roles.description', hideBelow: '4xl' },
  { id: 'count', labelKey: 'roles.users', hideBelow: 'xl' },
] as const;

const ROLE_SORT_FIELDS = ['name', 'type', 'count'] as const;

export type RoleSortField = (typeof ROLE_SORT_FIELDS)[number];

export const DEFAULT_ROLES_SORT: DefaultSort = { id: 'name', desc: false };

type RoleTypeValue = (typeof ROLE_TYPES)[number]['type'];

const roleTypeFilter = z
  .enum(ROLE_TYPES.map((item) => item.type) as [RoleTypeValue, ...RoleTypeValue[]])
  .optional()
  .catch(undefined);

export const rolesSearchSchema = tableSearchSchema(ROLE_SORT_FIELDS).extend({
  q: textFilterSchema,
  type: roleTypeFilter,
  /** The open dialog: `new` to create a role, or the id of the one being edited. */
  role: z
    .union([z.literal('new'), z.guid()])
    .optional()
    .catch(undefined),
  /** The role whose rights are shown. */
  rights: z.guid().optional().catch(undefined),
});

export type RolesSearch = z.infer<typeof rolesSearchSchema>;

/** Every filter off and back to the first page. */
export const CLEARED_ROLE_FILTERS = {
  q: undefined,
  type: undefined,
  page: undefined,
} satisfies Partial<RolesSearch>;

export function hasRoleFilters(search: RolesSearch) {
  return Boolean(search.q || search.type);
}
