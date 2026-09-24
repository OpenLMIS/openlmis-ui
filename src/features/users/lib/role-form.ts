import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { RightType } from '@/features/reference-data/lib/types';
import { assignmentKey, toSavedAssignment } from '@/features/users/lib/role-assignments';
import type { RoleAssignment } from '@/features/users/lib/types';

// Messages are translation keys so they follow a language switch, resolved at render.
const errorKey = (key: ParseKeys) => key;

const roleFormFields = z.object({
  roleId: z.string().nullable(),
  programId: z.string().nullable(),
  supervisoryNodeId: z.string().nullable(),
  warehouseId: z.string().nullable(),
});

export type RoleFormValues = z.input<typeof roleFormFields>;

export const EMPTY_ROLE_FORM: RoleFormValues = {
  roleId: null,
  programId: null,
  supervisoryNodeId: null,
  warehouseId: null,
};

/** The assignment the form describes, with only the ids its type uses. */
export function toRoleAssignment(type: RightType, values: RoleFormValues): RoleAssignment {
  return toSavedAssignment({
    roleId: values.roleId ?? '',
    ...(type === 'SUPERVISION' && {
      programId: values.programId,
      supervisoryNodeId: values.supervisoryNodeId,
    }),
    ...(type === 'ORDER_FULFILLMENT' && { warehouseId: values.warehouseId }),
  });
}

/** Each type needs its own fields; the same role twice, in the same place, is refused. */
export function roleFormSchema(type: RightType, assigned: readonly RoleAssignment[]) {
  const assignedKeys = new Set(assigned.map(assignmentKey));

  return roleFormFields.superRefine((values, context) => {
    const require = (path: keyof RoleFormValues, message: ParseKeys) => {
      if (!values[path]) context.addIssue({ code: 'custom', path: [path], message });
    };
    if (type === 'SUPERVISION') require('programId', 'users.roles.form.program-required');
    if (type === 'ORDER_FULFILLMENT') {
      require('warehouseId', 'users.roles.form.facility-required');
    }
    require('roleId', 'users.roles.form.role-required');

    if (values.roleId && assignedKeys.has(assignmentKey(toRoleAssignment(type, values)))) {
      context.addIssue({
        code: 'custom',
        path: ['roleId'],
        message: errorKey('users.roles.form.duplicate'),
      });
    }
  });
}
