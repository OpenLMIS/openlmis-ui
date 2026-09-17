import type { LoginInput, LoginResponse } from '@/features/auth/lib/types';
import { client } from '@/integrations/axios';

export class MissingAuthClientCredentialsError extends Error {
  constructor() {
    super('Missing VITE_AUTH_SERVER_CLIENT_ID or VITE_AUTH_SERVER_CLIENT_SECRET.');
    this.name = 'MissingAuthClientCredentialsError';
  }
}

// The auth service authenticates the client with HTTP Basic before the password grant.
export async function login({ username, password }: LoginInput): Promise<LoginResponse> {
  const clientId = import.meta.env.VITE_AUTH_SERVER_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_AUTH_SERVER_CLIENT_SECRET;

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
    },
  );

  return data;
}

export async function logout(): Promise<void> {
  await client.post('/users/auth/logout');
}
