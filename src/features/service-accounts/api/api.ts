import type { ServiceAccount, ServiceAccountsQuery } from '@/features/service-accounts/lib/types';
import { client } from '@/integrations/axios';
import { isNotFound } from '@/lib/http';
import type { Page } from '@/lib/types';

export async function fetchServiceAccounts(query: ServiceAccountsQuery) {
  const { data } = await client.get<Page<ServiceAccount>>('/apiKeys', { params: query });
  return data;
}

/** A key whose account could not be created, and which could not be deleted again either. */
export class KeyLeftBehindError extends Error {
  constructor(readonly token: string) {
    super(`Key ${token} was created without its service account`);
    this.name = 'KeyLeftBehindError';
  }
}

/** The key lives in the auth service and its account in reference data; a key left without one is deleted. */
export async function createServiceAccount(): Promise<ServiceAccount> {
  const { data: key } = await client.post<ServiceAccount>('/apiKeys');
  try {
    await client.post('/serviceAccounts', { token: key.token });
  } catch (error) {
    const removed = await client.delete(`/apiKeys/${key.token}`).then(
      () => true,
      () => false,
    );
    throw removed ? error : new KeyLeftBehindError(key.token);
  }
  return key;
}

const ignoreNotFound = (error: unknown) => {
  if (!isNotFound(error)) throw error;
};

/** The account first, as legacy does; either one already gone counts as deleted. */
export async function deleteServiceAccount(token: string): Promise<void> {
  await client.delete(`/serviceAccounts/${token}`).catch(ignoreNotFound);
  await client.delete(`/apiKeys/${token}`).catch(ignoreNotFound);
}
