import type { RightType, Role } from '@/features/reference-data/lib/types';

/** The four role types, in the order every screen lists them. */
export const ROLE_TYPES = [
  {
    type: 'SUPERVISION',
    labelKey: 'role-types.supervision',
    descriptionKey: 'role-types.supervision-description',
  },
  {
    type: 'ORDER_FULFILLMENT',
    labelKey: 'role-types.fulfillment',
    descriptionKey: 'role-types.fulfillment-description',
  },
  {
    type: 'REPORTS',
    labelKey: 'role-types.reports',
    descriptionKey: 'role-types.reports-description',
  },
  {
    type: 'GENERAL_ADMIN',
    labelKey: 'role-types.administration',
    descriptionKey: 'role-types.administration-description',
  },
] as const satisfies readonly { type: RightType; labelKey: string; descriptionKey: string }[];

type RoleTypeInfo = (typeof ROLE_TYPES)[number];

export function roleTypeInfo(type: RightType): RoleTypeInfo {
  return ROLE_TYPES.find((item) => item.type === type) ?? ROLE_TYPES[0];
}

/** A role's type is its first right's; a role with no rights has none. */
export const roleTypeOf = (role: Role | undefined): RightType | undefined => role?.rights[0]?.type;

// Kept as written rather than capitalized like a word.
const ACRONYMS: Record<string, string> = {
  BUQ: 'BUQ',
  CCE: 'CCE',
  DHIS2: 'DHIS2',
  MOH: 'MOH',
  PODS: 'PODs',
  PORALG: 'PORALG',
};

/** A right's code as words, e.g. `PODS_MANAGE` as "PODs Manage", for rights with no label. */
export function rightLabel(name: string) {
  return name
    .split('_')
    .filter(Boolean)
    .map((word) => ACRONYMS[word] ?? word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
