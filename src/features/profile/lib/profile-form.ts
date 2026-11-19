import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { Profile } from '@/features/profile/lib/types';
import type { UserContactDetails } from '@/lib/user-types';

// Messages are translation keys so they follow a language switch, resolved at render.
const errorKey = (key: ParseKeys) => key;

const requiredText = (key: ParseKeys) => z.string().trim().min(1, errorKey(key));

export const profileFormSchema = z.object({
  firstName: requiredText('users.form.first-name-required'),
  lastName: requiredText('users.form.last-name-required'),
  email: z
    .string()
    .trim()
    .refine(
      (email) => email === '' || z.email().safeParse(email).success,
      errorKey('users.form.email-invalid'),
    ),
  phoneNumber: z.string(),
  allowNotify: z.boolean(),
});

export type ProfileFormValues = z.input<typeof profileFormSchema>;

export function toProfileFormValues({ user, contact }: Profile): ProfileFormValues {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: contact?.emailDetails?.email ?? '',
    phoneNumber: contact?.phoneNumber ?? '',
    allowNotify: contact?.allowNotify ?? false,
  };
}

const orNull = (value: string) => value.trim() || null;

export type ProfileNameChanges = Partial<Pick<ProfileFormValues, 'firstName' | 'lastName'>>;

export function profileChanges(starting: ProfileFormValues, values: ProfileFormValues) {
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const firstNameChanged = firstName !== starting.firstName.trim();
  const lastNameChanged = lastName !== starting.lastName.trim();
  const names =
    firstNameChanged || lastNameChanged
      ? {
          ...(firstNameChanged && { firstName }),
          ...(lastNameChanged && { lastName }),
        }
      : undefined;
  const email = orNull(values.email) !== orNull(starting.email);
  return {
    names,
    contact:
      email ||
      orNull(values.phoneNumber) !== orNull(starting.phoneNumber) ||
      values.allowNotify !== starting.allowNotify,
    email,
  };
}

export function toContactDetails(
  { user, contact }: Profile,
  values: ProfileFormValues,
): UserContactDetails {
  return {
    referenceDataUserId: user.id,
    phoneNumber: orNull(values.phoneNumber),
    // Nothing can be sent without an address, as the legacy UI has it.
    allowNotify: values.allowNotify && orNull(values.email) !== null,
    // The notification service verifies a new address itself; the stored flag goes back unchanged.
    emailDetails: {
      email: orNull(values.email),
      emailVerified: contact?.emailDetails?.emailVerified ?? false,
    },
  };
}

export function savedContactDetails(
  previous: UserContactDetails | null,
  submitted: UserContactDetails,
): UserContactDetails {
  return {
    ...submitted,
    emailDetails: previous?.emailDetails ?? submitted.emailDetails,
  };
}
