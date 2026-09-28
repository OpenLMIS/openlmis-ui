import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { ContactDetails, Profile } from '@/features/profile/lib/types';

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

/** Which parts of the profile the form changed, so a save sends only those. */
export function profileChanges({ user, contact }: Profile, values: ProfileFormValues) {
  const email = orNull(values.email) !== (contact?.emailDetails?.email ?? null);
  return {
    user: values.firstName.trim() !== user.firstName || values.lastName.trim() !== user.lastName,
    contact:
      email ||
      orNull(values.phoneNumber) !== (contact?.phoneNumber ?? null) ||
      values.allowNotify !== (contact?.allowNotify ?? false),
    email,
  };
}

export function toContactDetails(
  { user, contact }: Profile,
  values: ProfileFormValues,
): ContactDetails {
  return {
    referenceDataUserId: user.id,
    phoneNumber: orNull(values.phoneNumber),
    allowNotify: values.allowNotify,
    // The notification service verifies a new address itself; the stored flag goes back unchanged.
    emailDetails: {
      email: orNull(values.email),
      emailVerified: contact?.emailDetails?.emailVerified ?? false,
    },
  };
}
