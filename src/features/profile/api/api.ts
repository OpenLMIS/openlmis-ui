import {
  type ProfileFormValues,
  profileChanges,
  toContactDetails,
} from '@/features/profile/lib/profile-form';
import type {
  DigestConfiguration,
  DigestSubscription,
  Profile,
} from '@/features/profile/lib/types';
import { client } from '@/integrations/axios';
import { getIfExists } from '@/lib/http';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';
import type { UserContactDetails, UserRecord } from '@/lib/user-types';

export function fetchContactDetails(userId: string): Promise<UserContactDetails | null> {
  return getIfExists<UserContactDetails>(`/userContactDetails/${userId}`);
}

/** A changed email waits here until its link is opened; nothing pending comes back empty. */
export async function fetchPendingEmail(userId: string): Promise<string | null> {
  const pending = await getIfExists<{ emailAddress?: string | null } | ''>(
    `/userContactDetails/${userId}/verifications`,
  );
  if (!pending) return null;
  return pending.emailAddress || null;
}

export async function saveProfile(
  profile: Profile,
  values: ProfileFormValues,
  onUserSaved?: () => void,
): Promise<void> {
  const scope = getSessionScope();
  const changes = profileChanges(profile, values);
  if (changes.user) {
    const { data: user } = await client.get<UserRecord>(`/users/${profile.user.id}`);
    assertSessionScope(scope);
    await client.put('/users', {
      ...user,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
    });
    assertSessionScope(scope);
    onUserSaved?.();
  }
  if (changes.contact) {
    await client.put(`/userContactDetails/${profile.user.id}`, toContactDetails(profile, values));
    assertSessionScope(scope);
  }
}

export async function resendVerification(userId: string): Promise<void> {
  await client.post(`/userContactDetails/${userId}/verifications`);
}

export async function changePassword(username: string, newPassword: string): Promise<void> {
  await client.post('/users/auth/passwordReset', { username, newPassword });
}

/** Every kind of notification a digest can gather; without paging params the endpoint returns all. */
export async function fetchDigestConfigurations(): Promise<DigestConfiguration[]> {
  const { data } = await client.get<Page<DigestConfiguration>>('/digestConfiguration');
  return data.content;
}

export async function fetchSubscriptions(userId: string): Promise<DigestSubscription[]> {
  return (await getIfExists<DigestSubscription[]>(`/users/${userId}/subscriptions`)) ?? [];
}

/** The list replaces every subscription the user has. */
export async function saveSubscriptions(
  userId: string,
  subscriptions: DigestSubscription[],
): Promise<void> {
  await client.post(`/users/${userId}/subscriptions`, subscriptions);
}
