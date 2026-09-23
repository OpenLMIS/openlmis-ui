import { describe, expect, it } from 'vitest';
import type { UserDetails } from '@/features/users/lib/types';
import {
  countHomeFacilityRoles,
  EMPTY_USER_FORM,
  toContactDetails,
  toUserFormValues,
  toUserRecord,
  userFormSchema,
} from '@/features/users/lib/user-form';

const details: UserDetails = {
  user: {
    id: 'u1',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    active: false,
    timezone: 'PST',
    extraData: { team: 'north' },
    homeFacilityId: 'f1',
    jobTitle: 'Nurse',
    roleAssignments: [
      { roleId: 'home', programId: 'p1' },
      { roleId: 'supervision', programId: 'p1', supervisoryNodeId: 'n1' },
      { roleId: 'admin' },
    ],
  },
  contact: {
    referenceDataUserId: 'u1',
    phoneNumber: '555',
    allowNotify: true,
    emailDetails: { email: 'ada@example.org', emailVerified: true },
  },
  auth: { id: 'u1', username: 'ada', enabled: true },
};

describe('userFormSchema', () => {
  it('requires a username and names, and a valid email when one is given', () => {
    const result = userFormSchema.safeParse({ ...EMPTY_USER_FORM, username: ' ', email: 'nope' });
    const messages = result.error?.issues.map((issue) => issue.message);

    expect(messages).toEqual([
      'users.form.username-required',
      'users.form.email-invalid',
      'users.form.first-name-required',
      'users.form.last-name-required',
    ]);
  });

  it('accepts an empty email', () => {
    const result = userFormSchema.safeParse({
      ...EMPTY_USER_FORM,
      username: 'ada',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(result.success).toBe(true);
  });
});

describe('toUserFormValues', () => {
  it('shows whether the user can sign in from the auth account', () => {
    expect(toUserFormValues(details).active).toBe(true);
    expect(toUserFormValues({ ...details, auth: null }).active).toBe(false);
  });
});

describe('toUserRecord', () => {
  it('keeps what the form does not show and trims what it does', () => {
    const values = { ...toUserFormValues(details), firstName: '  Augusta ', jobTitle: ' ' };

    expect(toUserRecord(values, details.user)).toEqual({
      ...details.user,
      firstName: 'Augusta',
      jobTitle: null,
      active: true,
    });
  });

  it('drops only the home facility roles when asked', () => {
    const values = {
      ...toUserFormValues(details),
      homeFacilityId: null,
      removeHomeFacilityRoles: true,
    };

    expect(toUserRecord(values, details.user).roleAssignments.map((role) => role.roleId)).toEqual([
      'supervision',
      'admin',
    ]);
    expect(countHomeFacilityRoles(details.user)).toBe(1);
  });
});

describe('toContactDetails', () => {
  it('sends the stored verification flag back and empty text as null', () => {
    const values = { ...toUserFormValues(details), email: 'new@example.org', phoneNumber: '' };

    expect(toContactDetails('u1', values, details.contact)).toEqual({
      referenceDataUserId: 'u1',
      phoneNumber: null,
      allowNotify: true,
      emailDetails: { email: 'new@example.org', emailVerified: true },
    });
  });
});
