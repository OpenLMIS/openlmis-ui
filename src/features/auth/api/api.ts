// import { client } from '@/integrations/axios';
import type { AuthenticatedUser, LoginInput } from '@/features/auth/lib/types';

/* TODO: Replace mock with a real endpoint. Throw `InvalidCredentialsError` for 401 so the form can surface a field-agnostic error. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsError';
  }
}

export async function login(input: LoginInput): Promise<AuthenticatedUser> {
  // Real implementation:
  //   const res = await client.post<AuthenticatedUser>('/auth/login', input);
  //   return res.data;

  // Mock latency so the loading state is visible during the demo.
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Demo credential gate: any email + the literal password `wrongpassword` fails;
  // everything else that passes the schema succeeds.
  if (input.password === 'wrongpassword') {
    throw new InvalidCredentialsError();
  }

  return {
    id: 1,
    name: input.email.split('@')[0],
    email: input.email,
  };
}
