import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import { ROLE_TYPES, roleTypeOf } from '@/features/reference-data/lib/roles';
import type { Right, RightType, Role } from '@/features/reference-data/lib/types';

// Messages are translation keys so they follow a language switch, resolved at render.
const errorKey = (key: ParseKeys) => key;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Role names are unique ignoring case, as the server's index is; the role being edited keeps its own. */
export function roleFormSchema(roles: readonly Role[], editingId?: string) {
  return z.object({
    type: z.custom<RightType>(),
    name: z
      .string()
      .trim()
      .min(1, errorKey('roles.form.name-required'))
      .refine(
        (name) => !roles.some((role) => role.id !== editingId && sameName(role.name, name)),
        errorKey('roles.form.name-taken'),
      ),
    description: z.string().trim().min(1, errorKey('roles.form.description-required')),
    rightIds: z.array(z.string()).min(1, errorKey('roles.form.rights-required')),
  });
}

export type RoleFormValues = z.input<ReturnType<typeof roleFormSchema>>;

export const EMPTY_ROLE_FORM: RoleFormValues = {
  type: ROLE_TYPES[0].type,
  name: '',
  description: '',
  rightIds: [],
};

/** Only the rights of the role's type: the form lists no others, and the server takes one type per role. */
export function toRoleFormValues(role: Role): RoleFormValues {
  // A role saved without rights has no type yet, so it starts on the first one.
  const type = roleTypeOf(role) ?? ROLE_TYPES[0].type;
  return {
    type,
    name: role.name,
    description: role.description ?? '',
    rightIds: role.rights.filter((right) => right.type === type).map((right) => right.id),
  };
}

/** Rights of another type than the role's, which the server stores but a save through this form drops. */
export function otherTypeRights(role: Role | undefined): Right[] {
  const type = roleTypeOf(role);
  return role?.rights.filter((right) => right.type !== type) ?? [];
}

/** Changing a role changes what everyone who holds it can do, so that is asked first. */
export function asksBeforeSaving(role: Role | undefined, holders: number) {
  return role !== undefined && holders > 0;
}

export type RoleBody = {
  id?: string;
  name: string;
  description: string;
  rights: Right[];
};

export function toRoleBody(
  values: RoleFormValues,
  rights: readonly Right[],
  id?: string,
): RoleBody {
  const chosen = new Set(values.rightIds);
  return {
    ...(id && { id }),
    name: values.name.trim(),
    description: values.description.trim(),
    rights: rights
      .filter((right) => chosen.has(right.id))
      .map(({ id: rightId, name, type }) => ({ id: rightId, name, type })),
  };
}
