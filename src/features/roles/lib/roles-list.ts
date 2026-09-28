import { ROLE_TYPES, roleTypeOf } from '@/features/reference-data/lib/roles';
import type { RightType, Role } from '@/features/reference-data/lib/types';
import type { RoleSortField } from '@/features/roles/lib/search';
import { fold } from '@/lib/text';

export function filterRoles(roles: Role[], { q, type }: { q?: string; type?: RightType }) {
  const term = q && fold(q.trim());
  return roles.filter(
    (role) =>
      (!type || roleTypeOf(role) === type) &&
      (!term || [role.name, role.description ?? ''].some((text) => fold(text).includes(term))),
  );
}

const byName = (a: Role, b: Role) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

// A role with no rights has no type, so it sorts after the four.
const typeRank = (role: Role) => {
  const index = ROLE_TYPES.findIndex((item) => item.type === roleTypeOf(role));
  return index === -1 ? ROLE_TYPES.length : index;
};

const COMPARE: Record<RoleSortField, (a: Role, b: Role) => number> = {
  name: byName,
  type: (a, b) => typeRank(a) - typeRank(b),
  count: (a, b) => (a.count ?? 0) - (b.count ?? 0),
};

export function sortRoles(roles: Role[], field: RoleSortField, desc: boolean) {
  const compare = COMPARE[field];
  return [...roles].sort((a, b) => (desc ? -compare(a, b) : compare(a, b)) || byName(a, b));
}

// The save response has no user count, so the listed one is kept until the list reloads.
export function withSavedRole(roles: Role[], saved: Role): Role[] {
  const listed = roles.find((role) => role.id === saved.id);
  if (!listed) return [...roles, { ...saved, count: 0 }];
  return roles.map((role) => (role.id === saved.id ? { ...saved, count: listed.count } : role));
}
