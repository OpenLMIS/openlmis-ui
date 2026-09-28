import type { ServiceAccount, ServiceAccountsQuery } from '@/features/service-accounts/lib/types';
import { client } from '@/integrations/axios';
import { isNotFound } from '@/lib/http';
import type { Page } from '@/lib/types';

export async function fetchServiceAccounts(query: ServiceAccountsQuery) {
  const { data } = await client.get<Page<ServiceAccount>>('/apiKeys', { params: query });
  return data;
}

/** The key lives in the auth service and its account in reference data; a key left without one is deleted. */
export async function createServiceAccount(): Promise<ServiceAccount> {
  const { data: key } = await client.post<ServiceAccount>('/apiKeys');
  try {
    await client.post('/serviceAccounts', { token: key.token });
  } catch (error) {
    await client.delete(`/apiKeys/${key.token}`).catch(() => undefined);
    throw error;
  }
  return key;
}

/** The account first, as legacy does; one already gone still lets the key be removed. */
export async function deleteServiceAccount(token: string): Promise<void> {
  try {
    await client.delete(`/serviceAccounts/${token}`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  await client.delete(`/apiKeys/${token}`);
}
