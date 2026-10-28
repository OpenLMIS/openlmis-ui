import { isAxiosError } from 'axios';
import { transformRequisition } from '@/features/requisitions/lib/transform';
import type {
  RequisitionRecord,
  RequisitionSearchResult,
  RequisitionStatusMessage,
  RequisitionsQuery,
} from '@/features/requisitions/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import { randomId } from '@/lib/random-id';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

export async function searchRequisitions(params: RequisitionsQuery) {
  const { data } = await client.get<Page<RequisitionSearchResult>>('/requisitions/search', {
    params,
    paramsSerializer: { indexes: null },
  });
  return data;
}

export async function fetchRequisition(id: string): Promise<RequisitionRecord> {
  const { data, headers } = await client.get<RequisitionRecord>(`/v2/requisitions/${id}`);
  return { ...data, eTag: headers.etag as string | undefined };
}
export async function fetchStatusMessages(id: string) {
  const { data } = await client.get<RequisitionStatusMessage[]>(
    `/requisitions/${id}/statusMessages`,
  );
  return data;
}
export function fetchRequisitionReport(id: string, params: { showInDoses: boolean; lang: string }) {
  return fetchReport(`/requisitions/${id}/print`, params);
}

export async function saveRequisition(
  record: RequisitionRecord,
  addedLineIds: readonly string[] = [],
): Promise<RequisitionRecord> {
  const scope = getSessionScope();
  const { data, headers } = await client.put<RequisitionRecord>(
    `/v2/requisitions/${record.id}`,
    transformRequisition(record, addedLineIds),
    { headers: record.eTag ? { 'If-Match': record.eTag } : {} },
  );
  assertSessionScope(scope);
  return { ...data, eTag: headers.etag as string | undefined };
}

export const createRequisitionActionAttempt = () => ({
  key: randomId(),
  sessionScope: getSessionScope(),
});
export type RequisitionActionAttempt = ReturnType<typeof createRequisitionActionAttempt>;
async function transition(
  id: string,
  action: 'submit' | 'authorize' | 'skip',
  attempt: RequisitionActionAttempt,
) {
  assertSessionScope(attempt.sessionScope);
  try {
    const config = { headers: { 'Idempotency-Key': attempt.key } };
    const path = `/requisitions/${id}/${action}`;
    const response =
      action === 'skip' ? await client.put(path, {}, config) : await client.post(path, {}, config);
    assertSessionScope(attempt.sessionScope);
    return response.data;
  } catch (error) {
    assertSessionScope(attempt.sessionScope);
    if (isAxiosError(error) && error.response && error.response.status !== 409)
      attempt.key = randomId();
    throw error;
  }
}
export const submitRequisition = (id: string, attempt: RequisitionActionAttempt) =>
  transition(id, 'submit', attempt);
export const authorizeRequisition = (id: string, attempt: RequisitionActionAttempt) =>
  transition(id, 'authorize', attempt);
export const skipRequisition = (id: string, attempt: RequisitionActionAttempt) =>
  transition(id, 'skip', attempt);
export async function deleteRequisition(id: string) {
  const scope = getSessionScope();
  await client.delete(`/requisitions/${id}`);
  assertSessionScope(scope);
}
