import type { LoginInput, LoginResponse } from '@/features/auth/lib/types';
import type { LoginData } from '@/features/auth/store/login-data';
import { client } from '@/integrations/axios';
import { getAuthClientCredentials } from '@/lib/runtime-config';

export class MissingAuthClientCredentialsError extends Error {
  constructor() {
    super('Missing VITE_AUTH_SERVER_CLIENT_ID or VITE_AUTH_SERVER_CLIENT_SECRET.');
    this.name = 'MissingAuthClientCredentialsError';
  }
}

// The auth service authenticates the client with HTTP Basic before the password grant.
export async function login({ username, password }: LoginInput): Promise<LoginResponse> {
  const { clientId, clientSecret } = getAuthClientCredentials();

  if (!clientId || !clientSecret) {
    throw new MissingAuthClientCredentialsError();
  }

  const { data } = await client.post<LoginResponse>(
    '/oauth/token?grant_type=password',
    { username, password },
    {
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      session: false,
    },
  );

  return data;
}

export const toLoginData = (response: LoginResponse): LoginData => ({
  referenceDataUserId: response.referenceDataUserId,
  username: response.username,
  accessToken: response.access_token,
  expiresIn: response.expires_in,
});

export async function logout(): Promise<void> {
  await client.post('/users/auth/logout', undefined, { session: false });
}

/** Every right the user holds, one string per grant, e.g. `REQUISITION_VIEW|facilityId|programId`. */
export async function fetchPermissionStrings(userId: string): Promise<string[]> {
  const { data } = await client.get<string[]>(`/users/${userId}/permissionStrings`);
  return data;
}

/** Emails a reset link to the account with this address; the server answers alike for any address. */
export async function requestPasswordReset(email: string): Promise<void> {
  await client.post('/users/auth/forgotPassword', undefined, {
    params: { email },
    anonymous: true,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await client.post('/users/auth/changePassword', { token, newPassword }, { anonymous: true });
}
