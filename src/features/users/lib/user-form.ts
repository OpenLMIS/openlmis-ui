import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import { isHomeFacilityRole } from '@/features/users/lib/role-assignments';
import type {
  AuthUser,
  UserContactDetails,
  UserDetails,
  UserRecord,
} from '@/features/users/lib/types';

// Messages are translation keys so they follow a language switch, resolved at render.
const errorKey = (key: ParseKeys) => key;

const requiredText = (key: ParseKeys) => z.string().trim().min(1, errorKey(key));

export const userFormSchema = z.object({
  // The reference data service only takes letters and digits in a username.
  username: requiredText('users.form.username-required').regex(
    /^[\p{L}\p{N}]*$/u,
    errorKey('users.form.username-invalid'),
  ),
  email: z
    .string()
    .trim()
    .refine(
      (email) => email === '' || z.email().safeParse(email).success,
      errorKey('users.form.email-invalid'),
    ),
  firstName: requiredText('users.form.first-name-required'),
  lastName: requiredText('users.form.last-name-required'),
  jobTitle: z.string(),
  phoneNumber: z.string(),
  active: z.boolean(),
  homeFacilityId: z.string().nullable(),
  allowNotify: z.boolean(),
  removeHomeFacilityRoles: z.boolean(),
});

export type UserFormValues = z.input<typeof userFormSchema>;

export const EMPTY_USER_FORM: UserFormValues = {
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  jobTitle: '',
  phoneNumber: '',
  active: true,
  homeFacilityId: null,
  allowNotify: false,
  removeHomeFacilityRoles: false,
};

export function toUserFormValues({ user, contact, auth }: UserDetails): UserFormValues {
  return {
    username: user.username,
    email: contact?.emailDetails?.email ?? '',
    firstName: user.firstName,
    lastName: user.lastName,
    jobTitle: user.jobTitle ?? '',
    phoneNumber: contact?.phoneNumber ?? '',
    // Signing in is decided by the auth account, so it is the one the form shows.
    active: auth?.enabled ?? user.active,
    homeFacilityId: user.homeFacilityId ?? null,
    allowNotify: contact?.allowNotify ?? false,
    removeHomeFacilityRoles: false,
  };
}

/** Roles that only apply at the home facility; they lose their meaning when it changes. */
export function countHomeFacilityRoles(user: UserRecord) {
  return user.roleAssignments.filter(isHomeFacilityRole).length;
}

const orNull = (value: string) => value.trim() || null;

/** The reference data user to save; fields the form does not show are kept from `existing`. */
export function toUserRecord(
  values: UserFormValues,
  existing?: UserRecord,
): Omit<UserRecord, 'id'> & { id?: string } {
  const roleAssignments = existing?.roleAssignments ?? [];
  // The choice only counts while the facility differs; picking the old one back hides and cancels it.
  const removeHomeFacilityRoles =
    values.removeHomeFacilityRoles && values.homeFacilityId !== (existing?.homeFacilityId ?? null);
  return {
    ...existing,
    username: values.username.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    jobTitle: orNull(values.jobTitle),
    homeFacilityId: values.homeFacilityId,
    active: values.active,
    roleAssignments: removeHomeFacilityRoles
      ? roleAssignments.filter((role) => !isHomeFacilityRole(role))
      : roleAssignments,
  };
}

export function toContactDetails(
  id: string,
  values: UserFormValues,
  existing?: UserContactDetails | null,
): UserContactDetails {
  return {
    referenceDataUserId: id,
    phoneNumber: orNull(values.phoneNumber),
    allowNotify: values.allowNotify,
    // The notification service verifies a new address itself; the stored flag goes back unchanged.
    emailDetails: {
      email: orNull(values.email),
      emailVerified: existing?.emailDetails?.emailVerified ?? false,
    },
  };
}

export function toAuthUser(id: string, values: UserFormValues): AuthUser {
  return { id, username: values.username.trim(), enabled: values.active };
}
