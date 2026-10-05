import type { ReasonBody, ValidReason, ValidReasonBody } from '@/features/reasons/lib/types';
import type { Reason } from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';

export async function fetchReason(id: string): Promise<Reason> {
  const { data } = await client.get<Reason>(`/stockCardLineItemReasons/${id}`);
  return data;
}

export async function createReason(body: ReasonBody): Promise<Reason> {
  const { data } = await client.post<Reason>('/stockCardLineItemReasons', body);
  return data;
}

export async function updateReason(id: string, body: ReasonBody): Promise<Reason> {
  const { data } = await client.put<Reason>(`/stockCardLineItemReasons/${id}`, body);
  return data;
}

export async function fetchReasonTypes(): Promise<string[]> {
  const { data } = await client.get<string[]>('/reasonTypes');
  return data;
}

export async function fetchReasonCategories(): Promise<string[]> {
  const { data } = await client.get<string[]>('/reasonCategories');
  return data;
}

/** Every tag any reason carries, offered as suggestions. */
export async function fetchReasonTags(): Promise<string[]> {
  const { data } = await client.get<string[]>('/stockCardLineItemReasonTags');
  return data.toSorted((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export async function fetchValidReasons(reasonId: string): Promise<ValidReason[]> {
  const { data } = await client.get<ValidReason[]>('/validReasons', {
    params: { reason: reasonId },
  });
  return data;
}

/** The server answers 200 with the one it already had for the same program, type and reason. */
export async function createValidReason(body: ValidReasonBody): Promise<ValidReason> {
  const { data } = await client.post<ValidReason>('/validReasons', body);
  return data;
}

export async function deleteValidReason(id: string) {
  await client.delete(`/validReasons/${id}`);
}
