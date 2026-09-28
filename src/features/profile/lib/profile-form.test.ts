import { describe, expect, it } from 'vitest';
import {
  profileChanges,
  profileFormSchema,
  toProfileFormValues,
} from '@/features/profile/lib/profile-form';
import type { Profile } from '@/features/profile/lib/types';

const profile: Profile = {
  user: {
    id: 'u1',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    active: true,
    roleAssignments: [],
  },
  contact: {
    referenceDataUserId: 'u1',
    phoneNumber: null,
    allowNotify: true,
    emailDetails: { email: 'ada@example.org', emailVerified: true },
  },
};

const values = toProfileFormValues(profile);

const messages = (input: unknown) =>
  profileFormSchema.safeParse(input).error?.issues.map((issue) => issue.message) ?? [];

describe('toProfileFormValues', () => {
  it('fills the form from the saved profile', () => {
    expect(values).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.org',
      phoneNumber: '',
      allowNotify: true,
    });
  });

  it('starts empty for a user without contact details', () => {
    expect(toProfileFormValues({ ...profile, contact: null })).toMatchObject({
      email: '',
      phoneNumber: '',
      allowNotify: false,
    });
  });
});

describe('profileFormSchema', () => {
  it('accepts the saved profile', () => {
    expect(messages(values)).toEqual([]);
  });

  it('requires a first and last name, blanks included', () => {
    expect(messages({ ...values, firstName: '  ', lastName: '' })).toEqual([
      'users.form.first-name-required',
      'users.form.last-name-required',
    ]);
  });

  it('allows no email, but not an invalid one', () => {
    expect(messages({ ...values, email: '' })).toEqual([]);
    expect(messages({ ...values, email: 'ada@' })).toEqual(['users.form.email-invalid']);
  });
});

describe('profileChanges', () => {
  it('finds nothing in the saved profile, or in surrounding spaces', () => {
    expect(profileChanges(profile, values)).toEqual({ user: false, contact: false, email: false });
    expect(profileChanges(profile, { ...values, firstName: ' Ada ' }).user).toBe(false);
  });

  it('tells a name change from a contact change', () => {
    expect(profileChanges(profile, { ...values, lastName: 'King' })).toEqual({
      user: true,
      contact: false,
      email: false,
    });
    expect(profileChanges(profile, { ...values, phoneNumber: '123' })).toEqual({
      user: false,
      contact: true,
      email: false,
    });
  });

  it('marks a new email, and a cleared one', () => {
    expect(profileChanges(profile, { ...values, email: 'new@example.org' })).toEqual({
      user: false,
      contact: true,
      email: true,
    });
    expect(profileChanges(profile, { ...values, email: ' ' }).email).toBe(true);
  });

  it('sees the switch turned off as a contact change', () => {
    expect(profileChanges(profile, { ...values, allowNotify: false }).contact).toBe(true);
  });
});
